import React, { useEffect, useState } from 'react';
import './Main.scss';
import { getLitAuthClient, getLitNodeClient, getPkpPubkeysByAddress, getRelayerPkps, getSessionSigs, mintPkp } from '../../lib/lit';
import * as LitJsSdk from "@lit-protocol/lit-node-client";
import * as LitJsSdk_types from "@lit-protocol/types";
import { AuthMethod } from '@lit-protocol/types';
import { ethers } from 'ethers';
import { PKPEthersWallet } from '@lit-protocol/pkp-ethers';
import { MUMBAI_RPC_URL, SIGN_TYPED_DATA_CODE, MESSAGE, LIT_ACTION_CALL_CODE, LIT_ACTION_SIGN_CODE, SIGN_TYPED_DATA } from '../../lib/constant';
import { SiweMessage } from 'ceramic-cacao';
import { BaseProvider, isSignInRedirect } from '@lit-protocol/lit-auth-client';
import { LitActionType, ProviderType } from '../../types';
import { getRawMessage } from '../../lib/message';

const Main = () => {
    const [googleProvider, setGoogleProvider] = useState<BaseProvider>();
    const [isGoogleAuthed, setIsGoogleAuthed] = useState<boolean>();
    const [account, setAccount] = useState("Account Address");
    const [authMethod, setAuthMethod] = useState<AuthMethod>();
    const [sessionSigs, setSessionSigs] = useState<LitJsSdk_types.SessionSigsMap>();
    const [pkpPublicKey, setPkpPublicKey] = useState<string>();
    const [pkpWallet, setPkpWallet] = useState<PKPEthersWallet>();
    const [pkpWalletType, setPkpWalletType] = useState<string>('Not Create');
    const [pkpWalletAddress, setPkpWalletAddress] = useState<string>('');
    const [pkpWalletBalance, setPkpWalletBalance] = useState<string>('');
    const [pkpWalletTxCount, setPkpWalletTxCount] = useState<number | string>('');
    const [pkpWalletNewTxHash, setPkpWalletNewTxHash] = useState<string>('');
    const [pkpSignature, setPkpSignature] = useState<string>('');
    const [pkpSignedMessage, setPkpSignedMessage] = useState<string>('');
    const [litActionResult, setLitActionResult] = useState<any>('');

    useEffect(() => {
        if (pkpWallet) {
            updateWalletInfo();
        }
    }, [pkpWallet])

    useEffect(() => {
        const client = getLitAuthClient();
        const provider = client.getProvider(
            ProviderType.Google
        );
        setGoogleProvider(provider);
    }, [])

    useEffect(() => {
        if (googleProvider) {
            if (isSignInRedirect(window.location.href)) {
                console.log(`[authed]${window.location.href}`)
                setIsGoogleAuthed(true);
                initSessionSigs();
            } else {
                console.log(`[Not authed]${window.location.href}`)
            }
        }
    }, [googleProvider])

    const initSessionSigs = async () => {
        if (googleProvider) {
            const authMethod: AuthMethod = await googleProvider.authenticate();
            setAuthMethod(authMethod);
            const relayerPkps = await getRelayerPkps(googleProvider, authMethod);
            console.log("relayerPkps:", relayerPkps)
            if (relayerPkps.length === 0) {
                setAccount("Mint PKP First");
                return;
            }
            setAccount(relayerPkps[0].ethAddress);
            setPkpPublicKey(relayerPkps[0].publicKey);
            try {
                const sessionSigs = await getSessionSigs(googleProvider, authMethod, relayerPkps[0].publicKey);
                console.log("sessionSigs=", sessionSigs);
                setSessionSigs(sessionSigs);
            } catch (error) {
                console.error(error);
            }
        }
    }

    const handleAuthGoogle = async () => {
        if (googleProvider) {
            await (googleProvider as any).signIn();
        } else {
            console.error('googleProvider undefined');
        }
    }

    const handleOnClickMintPkp = async () => {
        if (googleProvider && authMethod) {
            const txHash = await mintPkp(googleProvider, authMethod);
            console.log("txHash of mint PKP:", txHash);
        } else {
            console.error('googleProvider or authMethod undefined');
        }
    }

    const createPkpWallet = async (type: string) => {
        if (type === 'otherwallets') {
            const controllerAuthSig = await LitJsSdk.checkAndSignAuthMessage({ chain: 'mumbai' });  // metamask or walletconnect
            console.log("controllerAuthSig=", controllerAuthSig)
            const mintedPkpPubkeys = await getPkpPubkeysByAddress(controllerAuthSig.address);
            console.log("mintedPkpPubkeys=", mintedPkpPubkeys)
            if (mintedPkpPubkeys.length == 0) {
                alert('Please mint PKP NFT at https://explorer.litprotocol.com/mint-pkp first.');
                return;
            }
            const pkpEthersWallet = new PKPEthersWallet({
                pkpPubKey: mintedPkpPubkeys[0],
                controllerAuthSig,
                rpc: MUMBAI_RPC_URL,
            });

            console.log("pkpWallet(otherwallets):", pkpEthersWallet)
            await pkpEthersWallet.init();
            setPkpWallet(pkpEthersWallet);
            setPkpWalletType('OtherWallets');
        } else if (type === 'google') {
            if (pkpPublicKey) {
                if (sessionSigs) {
                    const pkpEthersWallet = new PKPEthersWallet({
                        pkpPubKey: pkpPublicKey,
                        controllerSessionSigs: sessionSigs,   //sessionSigs['https://serrano.litgateway.com:7370']
                        rpc: MUMBAI_RPC_URL,
                    });
                    console.log("pkpWallet(google):", pkpEthersWallet)
                    await pkpEthersWallet.init();
                    setPkpWallet(pkpEthersWallet);
                    setPkpWalletType('Google');
                } else {
                    console.error("sessionSigs undefined");
                }
            } else {
                console.error("pkpPublicKet undefined")
            }
        }
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

    const handleSendTransaction = async () => {
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

    const handleSignMessage = async () => {
        if (pkpWallet) {
            const signedMsg = await pkpWallet.signMessage(MESSAGE);
            console.log('signedMsg:', signedMsg);
            setPkpSignedMessage(signedMsg);
        }
    }

    const handleSignTypedData = async () => {
        if (pkpWallet) {
            const signature = await pkpWallet._signTypedData(SIGN_TYPED_DATA.domain, SIGN_TYPED_DATA.types, SIGN_TYPED_DATA.value);
            setPkpSignature(signature);
            console.log("pkp signature: ", signature);
        } else {
            console.error("NO Pkp Wallet Instance")
        }
    }

    const handleOperateLitActions = async (litActionType: LitActionType) => {
        const provider = new ethers.providers.Web3Provider((window as any).ethereum);
        const [accountAddress] = await provider.send("eth_requestAccounts", []);
        console.log("accountAddress:", accountAddress)
        const signer = provider.getSigner();
        const newJson = await getRawMessage(accountAddress);
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
            address: accountAddress,
        }

        const litNodeClient = await getLitNodeClient();

        let executeJsArgs: any;
        if (litActionType === LitActionType.Call) {
            executeJsArgs = {
                authSig,
                code: LIT_ACTION_CALL_CODE,
                // sessionSigs: sessionSigs,
                jsParams: {
                    address: accountAddress,
                    chain: 'mumbai'
                },
            };
        } else {
            const mintedPkpPubkeys = await getPkpPubkeysByAddress(accountAddress);
            console.log("mintedPkpPubkeys=", mintedPkpPubkeys)
            if (mintedPkpPubkeys.length == 0) {
                alert('Please mint PKP NFT at https://explorer.litprotocol.com/mint-pkp first.');
                return;
            }
            executeJsArgs = {
                authSig,
                code: LIT_ACTION_SIGN_CODE,
                // sessionSigs: sessionSigs,
                jsParams: {
                    toSign: [72, 101, 108, 108, 111, 32, 87, 111, 114, 108, 100],
                    publicKey: mintedPkpPubkeys[0],
                    sigName: "sig1",
                },
            };
        }
        const res = await litNodeClient.executeJs(executeJsArgs as any);
        console.log("executeJs res:", res);
        setLitActionResult(JSON.stringify(res));
    }

    return (
        <div id="Main">
            <div className='app-header'>
                <div className='account'>
                    {account}
                </div>
                <button disabled={googleProvider ? false : true} onClick={handleAuthGoogle}>{`AuthGoogle${isGoogleAuthed ? '(authed)' : ''}`}</button>
            </div>

            <div className='app-body'>
                <button className='block' disabled={googleProvider && authMethod ? false : true} onClick={handleOnClickMintPkp}>Mint PKP</button>
                <button disabled={pkpPublicKey && sessionSigs ? false : true} onClick={() => createPkpWallet('google')}>CreatePkpWallet(Google)</button>
                <button onClick={() => createPkpWallet('otherwallets')}>CreatePkpWallet(OtherWallets)</button>
                <label className='block'>{`Wallet Info (${pkpWalletType})`}</label>
                <div className='textarea typed'>{`Address: ${pkpWalletAddress}\nBalance: ${pkpWalletBalance}\nTransactions Count: ${pkpWalletTxCount}\n`}</div>
                <button disabled={pkpWallet ? false : true} onClick={handleSendTransaction}>SendTransaction</button>
                <label className='block'>Transaction Hash</label>
                <div className='textarea'>{pkpWalletNewTxHash}</div>
                <button disabled={pkpWallet ? false : true} onClick={handleSignMessage}>SignMessage</button>
                <label className='block'>Message</label>
                <div className='textarea typed'>{MESSAGE}</div>
                <label className='block'>Signed Message</label>
                <div className='textarea'>{pkpSignedMessage}</div>
                <button disabled={pkpWallet ? false : true} onClick={handleSignTypedData}>SignTypedData</button>
                <label className='block'>Signature Typed Data</label>
                <div className='textarea typed'>{SIGN_TYPED_DATA_CODE}</div>
                <label className='block'>Signature</label>
                <div className='textarea'>{pkpSignature}</div>
                <div className='divider' />
                <button onClick={() => handleOperateLitActions(LitActionType.Call)}>Run Call LitAction ( AuthSig generate by MetaMask ) </button>
                <button onClick={() => handleOperateLitActions(LitActionType.Sign)}>Run Sign LitAction ( AuthSig generate by MetaMask ) </button>
                <label className='block'>Call LitAction</label>
                <div className='textarea typed'>{LIT_ACTION_CALL_CODE}</div>
                <label className='block'>Sign LitAction</label>
                <div className='textarea typed'>{LIT_ACTION_SIGN_CODE}</div>
                <label className='block'>Result</label>
                <div className='textarea typed'>{litActionResult}</div>
            </div>
        </div>
    );
}

export default Main;