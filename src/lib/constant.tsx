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

const SIGN_TYPED_DATA = `
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

export {
    RPC_URL,
    REACT_APP_RELAY_API_URL,
    REACT_APP_RPC_URL,
    CONTRACT_ADDRESS,
    CONTRACT_ABI,
    CONTRACT_SRC_CODE,
    SIGN_TYPED_DATA
}