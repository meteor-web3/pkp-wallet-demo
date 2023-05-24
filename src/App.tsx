import React, { useEffect, useRef, useState } from 'react';
import './App.scss';
import { GoogleLogin, GoogleOAuthProvider } from "@react-oauth/google";
import { getLitNodeClient, getSessionSigs, mintPkp } from './services/lit';
import { publicKeyToAddress } from './utils';
import * as LitJsSdk from "@lit-protocol/lit-node-client";
import * as LitJsSdk_accessControlConditions from "@lit-protocol/access-control-conditions";
import * as LitJsSdk_blsSdk from "@lit-protocol/bls-sdk";
import * as LitJsSdk_authHelpers from "@lit-protocol/auth-helpers";
import * as LitJsSdk_types from "@lit-protocol/types";
import { AccsDefaultParams } from '@lit-protocol/types';

const REACT_APP_RELAY_API_URL="https://relay-server-staging.herokuapp.com"

const REACT_APP_RPC_URL="https://chain-rpc.litprotcol.com/http"

function App() {
  const [account, setAccount] = useState("Public Key");
  const [credentialResponse, setCredentialResponse] = useState();
  const [inputValue, setInputValue] = useState<string>();
  const [encryptedSymmetricKey, setEncryptedSymmetricKey] = useState<string>();

  const handleLoggedInToGoogle = async (
		credentialResponse: any
	) => {
		console.log("Got response from google sign in: ", {
			credentialResponse,
		});
    setCredentialResponse(credentialResponse);
	};

  const handleOnClickMintPkp = async () => {
    const requestId = await mintPkp(credentialResponse);
    if(requestId) {
      const getAuthStatusRes = await fetch(
        `${REACT_APP_RELAY_API_URL}/auth/status/${requestId}`,
        {
          headers: {
            "api-key": "1234567890",
          },
        }
      );

      if (getAuthStatusRes.status < 200 || getAuthStatusRes.status >= 400) {
        console.warn(
          "Something wrong with the API call",
          await getAuthStatusRes.json()
        );
        return;
      }
  
      const resBody = await getAuthStatusRes.json();
      console.log("Response OK", { body: resBody });
  
      if (resBody.error) {
        console.warn("Something wrong with the API call", {
          error: resBody.error,
        });
        return;
      } else if (resBody.status === "Succeeded") {
        console.info("Successfully authed", { ...resBody });
        setAccount(resBody.pkpEthAddress);
        return;
      }
    }
  }

  const handleOnClickEncrypt = async () => {
    if(inputValue && credentialResponse) {
      const litNodeClient = await getLitNodeClient();
      const { encryptedString, symmetricKey } = await LitJsSdk.encryptString(inputValue);

      console.log(`encryptedString=${encryptedString}, symmetricKey=${symmetricKey}`)

      console.log("itNodeClient.subnetPubKey=", litNodeClient.subnetPubKey)

      const encryptedSymmetricKey = LitJsSdk_blsSdk.wasmBlsSdkHelpers.encrypt(
        LitJsSdk.uint8arrayFromString(litNodeClient.subnetPubKey!, "base16"),
        symmetricKey
      );

      console.log(`encryptedSymmetricKey=${encryptedSymmetricKey}`)
      setEncryptedSymmetricKey(encryptedSymmetricKey.toString());

      // const { sessionSigs, authenticatedPkpPublicKey } = await getSessionSigs(
      //   litNodeClient,
      //   encryptedSymmetricKey,
      //   litNodeClient.generateAuthMethodForGoogleJWT(
      //     (credentialResponse as any).credential
      //   )
      // );

      // console.log(`sessionSigs=${sessionSigs}, authenticatedPkpPublicKey=${authenticatedPkpPublicKey}`)

      // const pkpEthAddress = publicKeyToAddress(authenticatedPkpPublicKey);

      // const unifiedAccessControlConditions: AccsDefaultParams[] = [
      //   {
      //     conditionType: "evmBasic",
      //     contractAddress: "",
      //     standardContractType: "",
      //     chain: "mumbai",
      //     method: "",
      //     parameters: [":userAddress"],
      //     returnValueTest: {
      //       comparator: "=",
      //       value:
      //         pkpEthAddress
      //     },
      //   },
      // ];
    
      // await litNodeClient.saveEncryptionKey({
      //   unifiedAccessControlConditions,
      //   symmetricKey,
      //   encryptedSymmetricKey,
      //   sessionSigs, // Not actually needed for storing encryption condition.
      //   chain: "ethereum",
      // });
    } else {
      console.error("invalid credentialResponse")
    }
  }

  const handleOnClickSendTransaction = () => {

  }

  return (
    <div className="App">
      <div className='app-header'>
        <div className='account'>
          {account}
        </div>
        <GoogleOAuthProvider clientId="843145319444-2ep5igb3g98tmlcoigl111kimd0upms3.apps.googleusercontent.com">
          <GoogleLogin
            onSuccess={handleLoggedInToGoogle}
            onError={() => {
              console.log("Login Failed");
            }}
            useOneTap
          />
        </GoogleOAuthProvider>
      </div>

      <div className='app-body'>
        <button className='block' onClick={handleOnClickMintPkp}>Mint PKP</button>
        <button disabled={credentialResponse ? false : true} onClick={handleOnClickEncrypt}>Encrypt</button>
        <label className='block'>Message</label>
        <input onChange={(e) => setInputValue(e.target.value)} />
        <label className='block'>Encrypted SymmetricKey</label>
        <div className='textarea'>{encryptedSymmetricKey}</div>
        <button disabled={credentialResponse ? false : true} onClick={handleOnClickSendTransaction}>SendTransaction</button>
      </div>
    </div>
  );
}

export default App;

