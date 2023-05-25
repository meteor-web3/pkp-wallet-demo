import React, { useEffect, useRef, useState } from 'react';
import './App.scss';
import { GoogleLogin, GoogleOAuthProvider } from "@react-oauth/google";
import { getLitNodeClient, getSessionSigs, mintPkp } from './services/lit';
import { publicKeyToAddress, retry } from './utils';
import * as LitJsSdk from "@lit-protocol/lit-node-client";
import * as LitJsSdk_accessControlConditions from "@lit-protocol/access-control-conditions";
import * as LitJsSdk_blsSdk from "@lit-protocol/bls-sdk";
import * as LitJsSdk_authHelpers from "@lit-protocol/auth-helpers";
import * as LitJsSdk_types from "@lit-protocol/types";
import { AccsDefaultParams } from '@lit-protocol/types';
import { ethers, Transaction } from 'ethers';
import { joinSignature, UnsignedTransaction } from 'ethers/lib/utils';
// import { PKPWallet } from 'pkp-eth-signer';
import {PKPEthersWallet} from '@lit-protocol/pkp-ethers';

const RPC_URL = "https://rpc-mumbai.maticvigil.com/"
const REACT_APP_RELAY_API_URL = "https://relay-server-staging.herokuapp.com"
const REACT_APP_RPC_URL = "https://chain-rpc.litprotcol.com/http"
const CONTRACT_ADDRESS = "0xa3EFb397e49d36D4F8d59A4bad62d63e3a8aB91d"
const CONTRACT_ABI = [{
  "inputs": [
    {
      "internalType": "uint256",
      "name": "value_",
      "type": "uint256"
    }
  ],
  "name": "setValue",
  "outputs": [],
  "stateMutability": "nonpayable",
  "type": "function"
},
{
  "inputs": [],
  "stateMutability": "nonpayable",
  "type": "constructor"
},
{
  "inputs": [],
  "name": "value",
  "outputs": [
    {
      "internalType": "uint256",
      "name": "",
      "type": "uint256"
    }
  ],
  "stateMutability": "view",
  "type": "function"
}
];
const CONTRACT_SRC_CODE = `
contract Test {
  uint256 public value = 0;

  constructor() {}

  function setValue(uint256 value_) external {
      value = value_;
  }
}
`
const SIGN_DATA = `
const domain = {
  chainId: 80001,
};

const types = {
  Person: [
    { name: 'name', type: 'string' },
    { name: 'wallet', type: 'address' }
  ],
  Mail: [
    { name: 'from', type: 'Person' },
    { name: 'to', type: 'Person' },
    { name: 'contents', type: 'string' }
  ]
};

const value = {
  from: {
    name: 'Cow',
    wallet: '0xCD2a3d9F938E13CD947Ec05AbC7FE734Df8DD826'
  },
  to: {
    name: 'Bob',
    wallet: '0xbBbBBBBbbBBBbbbBbbBbbbbBBbBbbbbBbBbbBBbB'
  },
  contents: 'Hello, Bob!'
};  
`

function App() {
  const rpcProvider: ethers.providers.JsonRpcProvider = new ethers.providers.JsonRpcProvider(RPC_URL);
  const [account, setAccount] = useState("Account Address");
  const [credentialResponse, setCredentialResponse] = useState();
  const [message, setMessage] = useState<string>();
  const [encryptMessage, setEncryptMessage] = useState<Blob>();
  const [decryptMessage, setDecryptMessage] = useState<string>();
  const [encryptedSymmetricKey, setEncryptedSymmetricKey] = useState<Uint8Array>();
  const [sessionSigs, setSessionSigs] = useState<LitJsSdk_types.SessionSigsMap>();
  const [authSig, setAuthSig] = useState<LitJsSdk_types.AuthSig>();
  const [pkpPublicKey, setPkpPublicKey] = useState<string>();
  // const [txParams, setTxParams] = useState<UnsignedTransaction>();
  const [signature, setSignature] = useState<string>();
  const [valueNew, setValueNew] = useState<string>();
  const [valueOnChain, setValueOnChain] = useState<number>();
  const [transactionHash, setTransactionHash] = useState<string>();
  const [pkpWalletAddress, setPkpWalletAddress] = useState<string>('');
  const [pkpWalletBalance, setPkpWalletBalance] = useState<string>('');
  const [pkpWalletTxCount, setPkpWalletTxCount] = useState<number | string>('');

  useEffect(() => {
    if (rpcProvider) {
      updateValueOnChain();
    }
  }, [rpcProvider])

  const createPkpWallet = async () => {
    const pkpPubKey = '0x044ea0dcd8c2cfbe0eb39cf6f52982f7da78c82fb6aaec8da0b390b250e97ef370edb2a423a4db802ef1660ab3ec8074b4350291810c7d778e88fda43470d7f9b7';
    const controllerAuthSig = await LitJsSdk.checkAndSignAuthMessage({ chain: 'mumbai' });  // metamask or walletconnect
    console.log("controllerAuthSig=", controllerAuthSig)
    // if (authSig && pkpPublicKey) {
      const pkpWallet = new PKPEthersWallet({
        pkpPubKey,
        controllerAuthSig,
        rpc: RPC_URL,
      });

      console.log("pkpWallet=", pkpWallet)

      await pkpWallet.init();

      await Promise.all([
        async function() {
          const address = await pkpWallet.getAddress();
          setPkpWalletAddress(address);
        }(),
        async function() {
          const balance = ethers.utils.formatEther(await pkpWallet.getBalance());
          setPkpWalletBalance(balance)
        }(),
        async function() {
          const txCount = await pkpWallet.getTransactionCount();
          setPkpWalletTxCount(txCount);
        }()
      ])

      // const tx = {
      //   to: "0x1cD4147AF045AdCADe6eAC4883b9310FD286d95a",
      //   value: 0,
      // };
      // const signedTx = await pkpWallet.signTransaction(tx)
      // console.log('signedTx:', signedTx);

      // const signedMsg = await pkpWallet.signMessage("Secret Message.. shh!");
      // console.log('signedMsg:', signedMsg);
    // }
  }

  const runLitAction = async (toSign: Uint8Array, sigName: string) => {
    if (sessionSigs && pkpPublicKey) {
      const litNodeClient = await getLitNodeClient();
      const litActionCode = `
        (async () => {
          const sigShare = await LitActions.signEcdsa({ toSign, publicKey, sigName });
        })();`;

      const executeJsArgs = {
        // authSig: 
        code: litActionCode,
        sessionSigs: sessionSigs,
        jsParams: {
          toSign,
          publicKey: pkpPublicKey,
          sigName,
        },
      };
      const res = await litNodeClient.executeJs(executeJsArgs as any);
      return res.signatures[sigName];
    } else {
      console.error("no sessionSigs and pkpPublicKey");
    }
  }

  const signTransaction = async (unsignedTx: UnsignedTransaction) => {
    const serializedTx = ethers.utils.serializeTransaction(unsignedTx);
    const unsignedTxn = ethers.utils.keccak256(serializedTx);
    const toSign = ethers.utils.arrayify(unsignedTxn);
    const signature = (await runLitAction(toSign, 'pkp-eth-sign-tx'))
      .signature;
    return ethers.utils.serializeTransaction(unsignedTx, signature);
  }

  const sendTransaction = async (signedTx: string) => {
    return await rpcProvider?.sendTransaction(signedTx);
  }

  const signTypedData = async (
    domain: ethers.TypedDataDomain,
    types: Record<string, ethers.TypedDataField[]>,
    message: Record<string, any>,
  ) => {
    // const { types, domain, primaryType, message } = JSON.parse(msgParams);
    if (types.EIP712Domain) {
      delete types.EIP712Domain;
    }
    const toSign = ethers.utils._TypedDataEncoder.hash(domain, types, message);
    console.log("toSign:", toSign)

    const signature = await runLitAction(
      ethers.utils.arrayify(toSign),
      'pkp-eth-sign-typed-data'
    );
    console.log("signature before join:", signature)
    return joinSignature({
      r: '0x' + signature.r,
      s: '0x' + signature.s,
      v: signature.recid,
    });
  }

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
    if (requestId) {
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
    if (message && credentialResponse) {
      const litNodeClient = await getLitNodeClient();
      const { encryptedString, symmetricKey } = await LitJsSdk.encryptString(message);

      console.log(`encryptedString=${encryptedString}, symmetricKey=${symmetricKey}`)

      setEncryptMessage(encryptedString);

      console.log("litNodeClient.subnetPubKey=", litNodeClient.subnetPubKey)

      const encryptedSymmetricKey = LitJsSdk_blsSdk.wasmBlsSdkHelpers.encrypt(
        LitJsSdk.uint8arrayFromString(litNodeClient.subnetPubKey!, "base16"),
        symmetricKey
      );

      console.log(`encryptedSymmetricKey=${encryptedSymmetricKey}`)
      setEncryptedSymmetricKey(encryptedSymmetricKey);


      const authMethod = litNodeClient.generateAuthMethodForGoogleJWT(
        (credentialResponse as any).credential
      );

      const { sessionSigs, authenticatedPkpPublicKey, litAuthSig } = await getSessionSigs(
        litNodeClient,
        encryptedSymmetricKey,
        authMethod
      );

      // const { sessionSigs, authenticatedPkpPublicKey } = await retry(async () => {
      //   await getSessionSigs(
      //     litNodeClient,
      //     encryptedSymmetricKey,
      //     authMethod
      //   );
      // })

      console.log("sessionSigs: ", sessionSigs);
      console.log("authenticatedPkpPublicKey: ", authenticatedPkpPublicKey);
      console.log("authSig: ", litAuthSig);

      setSessionSigs(sessionSigs);
      setPkpPublicKey(authenticatedPkpPublicKey);
      setAuthSig(litAuthSig);

      const pkpEthAddress = publicKeyToAddress(authenticatedPkpPublicKey);
      setAccount(pkpEthAddress);
      console.log("pkpEthAddress=", pkpEthAddress)

      const unifiedAccessControlConditions: AccsDefaultParams[] = [
        {
          conditionType: "evmBasic",
          contractAddress: "",
          standardContractType: "",
          chain: "mumbai",
          method: "",
          parameters: [":userAddress"],
          returnValueTest: {
            comparator: "=",
            value:
              pkpEthAddress
          },
        },
      ];

      await litNodeClient.saveEncryptionKey({
        unifiedAccessControlConditions,
        symmetricKey,
        encryptedSymmetricKey,
        sessionSigs, // Not actually needed for storing encryption condition.
        chain: "ethereum",
      });
    } else {
      console.error("invalid credentialResponse")
    }
  }

  const handleOnClickDecrypt = async () => {
    if (encryptMessage && encryptedSymmetricKey) {
      const litNodeClient = await getLitNodeClient();

      const { sessionSigs } = await getSessionSigs(
        litNodeClient,
        encryptedSymmetricKey,
        litNodeClient.generateAuthMethodForGoogleJWT(
          (credentialResponse as any).credential
        )
      );

      const unifiedAccessControlConditions: AccsDefaultParams[] = [
        {
          conditionType: "evmBasic",
          contractAddress: "",
          standardContractType: "",
          chain: "mumbai",
          method: "",
          parameters: [":userAddress"],
          returnValueTest: {
            comparator: "=",
            value:
              account
          },
        },
      ];

      const retrievedSymmKey = await litNodeClient.getEncryptionKey({
        unifiedAccessControlConditions,
        toDecrypt: LitJsSdk.uint8arrayToString(encryptedSymmetricKey, "base16"),
        sessionSigs,
      });

      const decryptedString = await LitJsSdk.decryptString(
        encryptMessage,
        retrievedSymmKey
      );

      setDecryptMessage(decryptedString);
    }
  }

  const handleOnClickSendTransaction = async () => {
    if (valueNew) {
      const iface = new ethers.utils.Interface(CONTRACT_ABI);
      console.log("valueNew=", valueNew)
      const txData = iface.encodeFunctionData("setValue", [BigInt(valueNew)]);
      const txParams: UnsignedTransaction = {
        nonce: await rpcProvider.getTransactionCount(account),
        to: CONTRACT_ADDRESS,
        data: txData,
        chainId: 80001,
        gasLimit: 4000000,
        gasPrice: await rpcProvider.getGasPrice()
      };
      console.log("txData=", txData)
      const signedTx = await signTransaction(txParams);
      console.log("signedTx=", signedTx)
      const tx = await sendTransaction(signedTx);
      console.log("tx=", tx)
      setTransactionHash(tx.hash);
      const res = await tx.wait();
      console.log("res=", res)
      updateValueOnChain();
    } else {
      console.error("Invalid new value input")
    }
  }

  const handleOnClickSignTypedData = async () => {
    // All properties on a domain are optional
    const domain = {
      chainId: 80001,
    };

    // The named list of all type definitions
    const types = {
      Person: [
        { name: 'name', type: 'string' },
        { name: 'wallet', type: 'address' }
      ],
      Mail: [
        { name: 'from', type: 'Person' },
        { name: 'to', type: 'Person' },
        { name: 'contents', type: 'string' }
      ]
    };

    // The data to sign
    const value = {
      from: {
        name: 'Cow',
        wallet: '0xCD2a3d9F938E13CD947Ec05AbC7FE734Df8DD826'
      },
      to: {
        name: 'Bob',
        wallet: '0xbBbBBBBbbBBBbbbBbbBbbbbBBbBbbbbBbBbbBBbB'
      },
      contents: 'Hello, Bob!'
    };

    const signature = await signTypedData(domain, types, value);
    setSignature(signature);
    console.log("signature: ", signature);
  }

  const updateValueOnChain = async () => {
    const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, rpcProvider);
    const value = await contract.value();
    setValueOnChain(value.toNumber());
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
        <input onChange={(e) => setMessage(e.target.value)} />
        <label className='block'>Encrypted SymmetricKey</label>
        <div className='textarea'>{encryptedSymmetricKey?.toString()}</div>
        <button disabled={sessionSigs && pkpPublicKey ? false : true} onClick={handleOnClickDecrypt}>Decrypt</button>
        <label className='block'>Decrypted Message</label>
        <div className='textarea'>{decryptMessage}</div>
        <button disabled={sessionSigs && pkpPublicKey ? false : true} onClick={handleOnClickSendTransaction}>SendTransaction(setValue)</button>
        <label className='block'>New Value</label>
        <input onChange={(e) => setValueNew(e.target.value)} />
        <label className='block'>{`Contract (${CONTRACT_ADDRESS})`}</label>
        <div className='textarea typed'>{CONTRACT_SRC_CODE}</div>
        <label className='block'>Value On Chain</label>
        <div className='textarea'>{valueOnChain}</div>
        <label className='block'>Transaction Hash</label>
        <div className='textarea'>{transactionHash}</div>
        <button disabled={sessionSigs && pkpPublicKey ? false : true} onClick={handleOnClickSignTypedData}>SignTypedData</button>
        <label className='block'>Signature Typed Data</label>
        <div className='textarea typed'>{SIGN_DATA}</div>
        <label className='block'>Signature</label>
        <div className='textarea'>{signature}</div>
        <button onClick={createPkpWallet}>CreatePkpWallet</button>
        <label className='block'>Wallet Info</label>
        <div className='textarea typed'>{`Address: ${pkpWalletAddress}\nBalance: ${pkpWalletBalance}\nTransactions Count: ${pkpWalletTxCount}`}</div>
      </div>
    </div>
  );
}

export default App;

