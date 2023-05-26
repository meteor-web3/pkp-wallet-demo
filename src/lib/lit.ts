import * as LitJsSdk from "@lit-protocol/lit-node-client";
import * as LitJsSdk_accessControlConditions from "@lit-protocol/access-control-conditions";
import * as LitJsSdk_blsSdk from "@lit-protocol/bls-sdk";
import * as LitJsSdk_authHelpers from "@lit-protocol/auth-helpers";
import * as LitJsSdk_types from "@lit-protocol/types";
import { AccsDefaultParams, AuthSig, AuthCallback, AuthMethod, IRelayPKP } from "@lit-protocol/types";
import { BaseProvider, isSignInRedirect, LitAuthClient } from "@lit-protocol/lit-auth-client";
import { LitAbility } from "@lit-protocol/auth-helpers";

const REACT_APP_RELAY_API_URL = "https://relay-server-staging.herokuapp.com"

enum ProviderType {
	Discord = "discord",
	Google = "google",
	EthWallet = "ethwallet",
	WebAuthn = "webauthn",
	Otp = "otp"
}

function getLitAuthClient(): LitAuthClient {
	const litAuthClient = new LitAuthClient({
		litRelayConfig: {
			// Request a Lit Relay Server API key here: https://forms.gle/RNZYtGYTY9BcD9MEA
			relayApiKey: REACT_APP_RELAY_API_URL,
		},
	});
	console.log("litAuthClient:", litAuthClient)

	// Initialize Google provider
	litAuthClient.initProvider(ProviderType.Google, {
		// The URL of your web app where users will be redirected after authentication
		redirectUri: 'http://localhost:3000',
	});

	return litAuthClient;
}

async function mintPkp(provider: BaseProvider, authMethod: AuthMethod): Promise<string> {
	const txHash = await provider.mintPKPThroughRelayer(authMethod);
	return txHash;
}

async function getRelayerPkps(provider: BaseProvider, authMethod: AuthMethod): Promise<IRelayPKP[]> {
	const relayerPkps: IRelayPKP[] = await provider.fetchPKPsThroughRelayer(authMethod);
	return relayerPkps;
}

async function getSessionSigs(provider: BaseProvider, authMethod: AuthMethod, pkpPublicKey: string) {
	const litResource = new LitJsSdk_authHelpers.LitAccessControlConditionResource(
		''
	);

	const sessionSigs = await provider.getSessionSigs({
		pkpPublicKey,
		authMethod,
		sessionSigsParams: {
			chain: 'mumbai',
			resourceAbilityRequests: [{
				resource: litResource,
				ability: LitAbility.AccessControlConditionDecryption
			}],
		},
	});
	return sessionSigs;
}

async function getLitNodeClient(): Promise<LitJsSdk.LitNodeClient> {
	const litNodeClient = new LitJsSdk.LitNodeClient({
		litNetwork: "serrano",
		debug: false
	});
	await litNodeClient.connect();

	return litNodeClient;
}

export {
	getLitAuthClient,
	getLitNodeClient,
	getSessionSigs,
	mintPkp,
	getRelayerPkps,
	ProviderType
}