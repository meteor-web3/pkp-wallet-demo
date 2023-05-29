import TEST_CONTRACT_ABI from "../contracts/TestContractABI.json"

const MUMBAI_RPC_URL = "https://rpc-mumbai.maticvigil.com/"
const CHRONICLE_RPC_URL = "https://chain-rpc.litprotocol.com/http"
const RELAY_API_KEY = "0D7D660D-FA48-4AC7-8376-E14CDC2B350A_dataverse"
const REACT_APP_RPC_URL = "https://chain-rpc.litprotcol.com/http"
const PUBKEY_ROUTER_CONTRACT_ADDRESS = "0xB35cC6CaB1501d5F3b6b8fcF3215898C9d03E981"
const TEST_CONTRACT_ADDRESS = "0xa3EFb397e49d36D4F8d59A4bad62d63e3a8aB91d"

const CONTRACT_SRC_CODE = `contract Test {
  uint256 public value = 0;

  constructor() {}

  function setValue(uint256 value_) external {
      value = value_;
  }
}
`

const MESSAGE = 'Hello World!'

const SIGN_TYPED_DATA_CODE = `const domain = {
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

const SIGN_TYPED_DATA = {
  domain: {
    chainId: 80001,
  },
  types: {
    Person: [
      { name: 'name', type: 'string' },
      { name: 'wallet', type: 'address' }
    ],
    Mail: [
      { name: 'from', type: 'Person' },
      { name: 'to', type: 'Person' },
      { name: 'contents', type: 'string' }
    ]
  },
  value: {
    from: {
      name: 'Cow',
      wallet: '0xCD2a3d9F938E13CD947Ec05AbC7FE734Df8DD826'
    },
    to: {
      name: 'Bob',
      wallet: '0xbBbBBBBbbBBBbbbBbbBbbbbBBbBbbbbBbBbbBBbB'
    },
    contents: 'Hello, Bob!'
  }
}

const LIT_ACTION_CALL_CODE = `(async () => {
    const latestNonce = await Lit.Actions.getLatestNonce({ address, chain });
    Lit.Actions.setResponse({response: JSON.stringify({latestNonce})});
})();`;

const LIT_ACTION_SIGN_CODE = `(async () => {
    const sigShare = await Lit.Actions.signEcdsa({ toSign, publicKey , sigName });
    Lit.Actions.setResponse({response: JSON.stringify({sigShare})});
})();`;

export {
  MUMBAI_RPC_URL,
  CHRONICLE_RPC_URL,
  RELAY_API_KEY,
  REACT_APP_RPC_URL,
  PUBKEY_ROUTER_CONTRACT_ADDRESS,
  TEST_CONTRACT_ADDRESS,
  TEST_CONTRACT_ABI,
  CONTRACT_SRC_CODE,
  SIGN_TYPED_DATA_CODE,
  SIGN_TYPED_DATA,
  MESSAGE,
  LIT_ACTION_CALL_CODE,
  LIT_ACTION_SIGN_CODE
}