import React, { useEffect, useRef, useState } from 'react';
import './Main.scss';
import { getLitAuthClient, getLitNodeClient, getRelayerPkps, getSessionSigs, mintPkp, ProviderType } from '../../lib/lit';
import * as LitJsSdk from "@lit-protocol/lit-node-client";
import * as LitJsSdk_types from "@lit-protocol/types";
import { AuthMethod } from '@lit-protocol/types';
import { ethers } from 'ethers';
import { PKPEthersWallet } from '@lit-protocol/pkp-ethers';
import { RPC_URL, SIGN_TYPED_DATA, MESSAGE, LIT_ACTION_CODE } from '../../lib/constant';
import MessageJson from '../../json/message.json';
import { SiweMessage } from 'ceramic-cacao';
import axios from 'axios';
import { BaseProvider, isSignInRedirect } from '@lit-protocol/lit-auth-client';

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
            // const pkpPubKey = '0x044ea0dcd8c2cfbe0eb39cf6f52982f7da78c82fb6aaec8da0b390b250e97ef370edb2a423a4db802ef1660ab3ec8074b4350291810c7d778e88fda43470d7f9b7';    //google oauth
            const pkpPubKey = '0x04cac1d3910e160b465527807c30364b3612632cd76eb764270afc159bcbc255aff1bb3150df2360b246bce4b11e99fec43364acb61f40e1f41168f5ced6d610d6';
            const controllerAuthSig = await LitJsSdk.checkAndSignAuthMessage({ chain: 'mumbai' });  // metamask or walletconnect
            console.log("controllerAuthSig=", controllerAuthSig)
            const pkpEthersWallet = new PKPEthersWallet({
                pkpPubKey,
                controllerAuthSig,
                rpc: RPC_URL,
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
                        rpc: RPC_URL,
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

    const handleOperateLitActions = async () => {
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

        const getLitAuthSig = async () => {
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
                <div className='textarea typed'>{SIGN_TYPED_DATA}</div>
                <label className='block'>Signature</label>
                <div className='textarea'>{pkpSignature}</div>
                <div className='divider' />
                <button onClick={handleOperateLitActions}>Run LitAction ( AuthSig generate by MetaMask ) </button>
                <label className='block'>LitAction</label>
                <div className='textarea typed'>{LIT_ACTION_CODE}</div>
                <label className='block'>Result</label>
                <div className='textarea typed'>{litActionResult}</div>
            </div>
        </div>
    );
}

export default Main;