import React, { useEffect, useRef, useState } from 'react';
import './App.scss';
import { GoogleLogin, GoogleOAuthProvider } from "@react-oauth/google";
import { getLitNodeClient, getSessionSigs, mintPkp } from './lib/lit';
import { publicKeyToAddress, retry } from './utils';
import * as LitJsSdk from "@lit-protocol/lit-node-client";
import * as LitJsSdk_accessControlConditions from "@lit-protocol/access-control-conditions";
import * as LitJsSdk_blsSdk from "@lit-protocol/bls-sdk";
import * as LitJsSdk_authHelpers from "@lit-protocol/auth-helpers";
import * as LitJsSdk_types from "@lit-protocol/types";
import { AccsDefaultParams } from '@lit-protocol/types';
import { ethers } from 'ethers';
import { joinSignature, UnsignedTransaction } from 'ethers/lib/utils';
import { PKPEthersWallet } from '@lit-protocol/pkp-ethers';
import { CONTRACT_ABI, CONTRACT_ADDRESS, CONTRACT_SRC_CODE, REACT_APP_RELAY_API_URL, RPC_URL, SIGN_TYPED_DATA } from './lib/constant';
import MessageJson from './json/message.json';
import { SiweMessage } from 'ceramic-cacao';
import axios from 'axios';

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
  const [pkpWallet, setPkpWallet] = useState<PKPEthersWallet>();
  const [pkpWalletAddress, setPkpWalletAddress] = useState<string>('');
  const [pkpWalletBalance, setPkpWalletBalance] = useState<string>('');
  const [pkpWalletTxCount, setPkpWalletTxCount] = useState<number | string>('');
  const [pkpWalletNewTxHash, setPkpWalletNewTxHash] = useState<string>('');
  const [pkpSignature, setPkpSignature] = useState<string>('');

  useEffect(() => {
    if (rpcProvider) {
      updateValueOnChain();
    }
  }, [rpcProvider])

  useEffect(() => {
    if (pkpWallet) {
      updateWalletInfo();
    }
  }, [pkpWallet])

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

  const createPkpWallet = async () => {
    // const pkpPubKey = '0x044ea0dcd8c2cfbe0eb39cf6f52982f7da78c82fb6aaec8da0b390b250e97ef370edb2a423a4db802ef1660ab3ec8074b4350291810c7d778e88fda43470d7f9b7';    //google oauth
    const pkpPubKey = '0x04cac1d3910e160b465527807c30364b3612632cd76eb764270afc159bcbc255aff1bb3150df2360b246bce4b11e99fec43364acb61f40e1f41168f5ced6d610d6';
    const controllerAuthSig = await LitJsSdk.checkAndSignAuthMessage({ chain: 'mumbai' });  // metamask or walletconnect
    console.log("controllerAuthSig=", controllerAuthSig)
    // if (authSig && pkpPublicKey) {
    const pkpEthersWallet = new PKPEthersWallet({
      pkpPubKey,
      controllerAuthSig,
      rpc: RPC_URL,
    });

    console.log("pkpWallet=", pkpEthersWallet)

    await pkpEthersWallet.init();
    setPkpWallet(pkpEthersWallet);

    // await updateWalletInfo();
    // await sendTransaction();

    // }
  }

  const updateWalletInfo = async () => {
    if (pkpWallet) {
      await Promise.all([
        async function () {
          const address = await pkpWallet.getAddress();
          setPkpWalletAddress(address);
        }(),
        async function () {
          const balance = ethers.utils.formatEther(await pkpWallet.getBalance());
          setPkpWalletBalance(balance)
        }(),
        async function () {
          const txCount = await pkpWallet.getTransactionCount();
          setPkpWalletTxCount(txCount);
        }()
      ])
    }
  }

  const sendTransactionByPkpWallet = async () => {
    if (pkpWallet) {
      const tx = {
        to: "0x13a6D1fe418de7e5B03Fb4a15352DfeA3249eAA4",
        value: BigInt('10000000000000000'),
      };
      const signedTx = await pkpWallet.signTransaction(tx)
      console.log('signedTx:', signedTx);

      const res = await pkpWallet.sendTransaction(signedTx);
      console.log("res:", res)
      setPkpWalletNewTxHash(res.hash);
      await res.wait();
      await updateWalletInfo();
    }
  }

  const signMessageByPkpWallet = async () => {
    if (pkpWallet) {
      const signedMsg = await pkpWallet.signMessage("Secret Message.. shh!");
      console.log('signedMsg:', signedMsg);
    }
  }

  const handleOnClickSignTypedDataByPkpWallet = async () => {
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

    if (pkpWallet) {
      const signature = await pkpWallet._signTypedData(domain, types, value);
      setPkpSignature(signature);
      console.log("pkp signature: ", signature);
    } else {
      console.error("NO Pkp Wallet Instance")
    }
  }

  const modifyJson = async (address: string) => {
    const now = new Date();
    const oneWeekLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    try {
      const res = await axios({
        url: `https://gateway.dataverse.art/v1/siwe/nonce`,
        method: "post",
        data: {
          address,
          domain: window.location.host,
        },
      });
      const nonce = res.data.data.nonce;
      MessageJson.nonce = nonce;
      MessageJson.issuedAt = now.toISOString();
      MessageJson.expirationTime = oneWeekLater.toISOString();
    } catch (error) {
      console.error(error);
    } finally {
      return MessageJson;
    }
  }

  const operateLitActionsDirectly = async () => {
    const provider = new ethers.providers.Web3Provider((window as any).ethereum);
    const [account] = await provider.send("eth_requestAccounts", []);
    console.log("account:", account)
    const signer = provider.getSigner();
    const newJson = await modifyJson(account);
    console.log("newJson:", newJson)
    const siweMessage = new SiweMessage(newJson);
    const message = siweMessage.toMessage();
    console.log("message:", message)
    const signature = await signer.signMessage(message);
    console.log('signature:', signature)
    const authSig = {
      sig: signature,
      derivedVia: "web3.eth.personal.sign",
      signedMessage: message,
      address: account,
    }

    const litNodeClient = await getLitNodeClient();
    const litActionCode = `
      (async () => {
        const latestNonce = await Lit.Actions.getLatestNonce({ address, chain });
        Lit.Actions.setResponse({response: JSON.stringify({latestNonce})});
      })();`;

    const getAuthSig = async () => {
      const controllerAuthSig = await LitJsSdk.checkAndSignAuthMessage({ chain: 'mumbai' });  // metamask or walletconnect
      console.log("controllerAuthSig:", controllerAuthSig)
      return controllerAuthSig
    }

    const executeJsArgs = {
      authSig,
      code: litActionCode,
      // sessionSigs: sessionSigs,
      jsParams: {
        address: account,
        chain: 'mumbai'
      },
    };
    const res = await litNodeClient.executeJs(executeJsArgs as any);
    console.log("executeJs res:", res)
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
        <div className='textarea typed'>{SIGN_TYPED_DATA}</div>
        <label className='block'>Signature</label>
        <div className='textarea'>{signature}</div>
        <div className='divider' />
        <button onClick={createPkpWallet}>CreatePkpWallet</button>
        <label className='block'>Wallet Info</label>
        <div className='textarea typed'>{`Address: ${pkpWalletAddress}\nBalance: ${pkpWalletBalance}\nTransactions Count: ${pkpWalletTxCount}\n`}</div>
        <button disabled={pkpWallet ? false : true} onClick={sendTransactionByPkpWallet}>SendTransaction By PKP-Wallet</button>
        <label className='block'>Transaction Hash</label>
        <div className='textarea'>{pkpWalletNewTxHash}</div>
        <button disabled={pkpWallet ? false : true} onClick={handleOnClickSignTypedDataByPkpWallet}>SignTypedData By PKP-Wallet</button>
        <label className='block'>Signature Typed Data</label>
        <div className='textarea typed'>{SIGN_TYPED_DATA}</div>
        <label className='block'>Signature By Pkp-Wallet</label>
        <div className='textarea'>{pkpSignature}</div>
        <button onClick={operateLitActionsDirectly}>Operate LitAction</button>
      </div>
    </div>
  );
}

export default App;

