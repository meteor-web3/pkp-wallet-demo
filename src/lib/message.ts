import axios from "axios";
import { ethers } from "ethers";

const RawMessage = {
    domain: "cekpfnklcifiomgeogbmknnmcgbkdpim",
    address: "0x13a6D1fe418de7e5B03Fb4a15352DfeA3249eAA4",
    statement: "Give this application access to some of your data",
    version: "1",
    uri: "did:key:z6MkerApT2JyBWX57oS2g8vk7aqgyVFFg7xLeZQHpHHbXdmL",
    nonce: "LyAgchu0ppDLBO",
    issuedAt: "2023-05-25T11:05:22.679Z",
    expirationTime: "2023-06-01T11:05:22.679Z",
    chainId: "80001",
    resources: [
        "ceramic://*?model=kjzl6hvfrbw6c7sf2o6pueqacza0x9zza54pdxdrei50aw1gesmrewghope97f9",
        "ceramic://*?model=kjzl6hvfrbw6c9p8dty6snnp028mzau052p9s7edj9tffef393h2pels32ykocz",
        "ceramic://*?model=kjzl6hvfrbw6c56xdo1a2z8s96z31i70vyz8rm7bzhr8uz8an9xmk27apcp6lst",
        "ceramic://*?model=kjzl6hvfrbw6c6fmbkbnaxut1ksfljgiq24a7y9z47o15stntc5nbdat655a0d1"
    ]
}

const getRawMessage = async (address: string) => {
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
        RawMessage.address = ethers.utils.getAddress(address);     // to checksum address
        RawMessage.nonce = nonce;
        RawMessage.issuedAt = now.toISOString();
        RawMessage.expirationTime = oneWeekLater.toISOString();
    } catch (error) {
        console.error(error);
    } finally {
        return RawMessage;
    }
}

export {
    getRawMessage
}