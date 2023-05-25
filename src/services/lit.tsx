import * as LitJsSdk from "@lit-protocol/lit-node-client";
import * as LitJsSdk_accessControlConditions from "@lit-protocol/access-control-conditions";
import * as LitJsSdk_blsSdk from "@lit-protocol/bls-sdk";
import * as LitJsSdk_authHelpers from "@lit-protocol/auth-helpers";
import * as LitJsSdk_types from "@lit-protocol/types";
import { AccsDefaultParams, AuthSig, AuthCallback } from "@lit-protocol/types";

const REACT_APP_RELAY_API_URL = "https://relay-server-staging.herokuapp.com"

async function getLitNodeClient(): Promise<LitJsSdk.LitNodeClient> {
	const litNodeClient = new LitJsSdk.LitNodeClient({
		litNetwork: "serrano",
		debug: false
	});
	await litNodeClient.connect();

	return litNodeClient;
}

async function getSessionSigs(
	litNodeClient: LitJsSdk.LitNodeClient,
	encryptedSymmetricKey: Uint8Array,
	authMethod: LitJsSdk_types.AuthMethod
): Promise<{
	sessionSigs: LitJsSdk_types.SessionSigsMap;
	authenticatedPkpPublicKey: string;
	litAuthSig: LitJsSdk_types.AuthSig
}> {
	let authenticatedPkpPublicKey: string;
	let litAuthSig: LitJsSdk_types.AuthSig;

	// this will be fired if auth is needed. we can use this to prompt the user to sign in
	const authNeededCallback: AuthCallback = async ({
		resources,
		expiration,
		statement,
	}) => {
		console.log("authNeededCallback fired");

		// Generate authMethod.
		const authMethods = [authMethod];

		// Get AuthSig
		const { authSig, pkpPublicKey } = await litNodeClient.signSessionKey({
			authMethods,
			statement,
			expiration:
				expiration ||
				new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString(), // 24 hours
			resources: resources || [],
		});
		console.log("got session sig from node and PKP: ", {
			authSig,
			pkpPublicKey,
		});

		authenticatedPkpPublicKey = pkpPublicKey;
		litAuthSig = authSig;

		return authSig;
	};

	const hashedEncryptedSymmetricKeyStr = await hashBytes({
		bytes: new Uint8Array(encryptedSymmetricKey),
	});

	console.log(`hashedEncryptedSymmetricKeyStr=${hashedEncryptedSymmetricKeyStr}`)

	// Construct the LitResource
	const litResource = new LitJsSdk_authHelpers.LitAccessControlConditionResource(
		hashedEncryptedSymmetricKeyStr
	);

	console.log(`litResource=${litResource}`)

	// Get the session sigs
	const sessionSigs = await litNodeClient.getSessionSigs({
		expiration: new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString(), // 24 hours
		chain: "ethereum",
		resourceAbilityRequests: [
			{
				resource: litResource,
				ability:
					LitJsSdk_authHelpers.LitAbility
						.AccessControlConditionDecryption,
			},
		],
		switchChain: false,
		authNeededCallback,
	});

	return {
		sessionSigs,
		authenticatedPkpPublicKey: authenticatedPkpPublicKey!,
		litAuthSig: litAuthSig!,
	};
}

async function mintPkp(credentialResponse: any) {
	if (credentialResponse) {
		const mintRes = await fetch(`${REACT_APP_RELAY_API_URL}/auth/google`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"api-key": "1234567890",
			},
			body: JSON.stringify({
				idToken: (credentialResponse as any).credential,
			}),
		});

		if (mintRes.status < 200 || mintRes.status >= 400) {
			console.warn("Something wrong with the API call", await mintRes.json());
			return null;
		} else {
			const resBody = await mintRes.json();
			console.log("Response OK", { body: resBody });
			return resBody.requestId;
		}
	}
}

async function hashBytes({ bytes }: { bytes: Uint8Array }): Promise<string> {
	const hashOfBytes = await crypto.subtle.digest("SHA-256", bytes);
	const hashOfBytesStr = LitJsSdk.uint8arrayToString(
		new Uint8Array(hashOfBytes),
		"base16"
	);
	return hashOfBytesStr;
}

export {
	getLitNodeClient,
	getSessionSigs,
	mintPkp,
}