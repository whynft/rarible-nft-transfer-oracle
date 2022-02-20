import { Fluence, KeyPair as FluenceKeyPair } from "@fluencelabs/fluence";
import { krasnodar } from "@fluencelabs/fluence-network-environment";
import * as fs from 'fs';
import * as path from 'path';
import { Buffer } from 'buffer';
// import {storageAbi} from '/.storage';
import HDWalletProvider from "@truffle/hdwallet-provider";
import { OracleApiDef, registerOracleApi } from "./_aqua/oracle";
import Web3 from "web3";
import { signTypedData_v4 } from "eth-sig-util"
import { privateToAddress } from "ethereumjs-util"

const config = {
	mainnetRpc: "https://mainnet.infura.io/v3/84653a332a3f4e70b1a46aaea97f0435",
	rinkebyRps: "https://rinkeby.infura.io/v3/84653a332a3f4e70b1a46aaea97f0435",
	ropstenRpc: "https://ropsten.infura.io/v3/84653a332a3f4e70b1a46aaea97f0435",
 	rinkebyWss: "wss://rinkeby.infura.io/ws/v3/84653a332a3f4e70b1a46aaea97f0435",
 	ropstenWss: "wss://ropsten.infura.io/ws/v3/84653a332a3f4e70b1a46aaea97f0435",
 	rinkeby: "rinkeby",
 	bridgeSenderContract: "0x65aAfb68470c570867E7F73d5461889d275f97c9",
 	chainId: 3, // is ropsten
 	oracleAddress: "0xa7A1462A3F067E959a4DDD0630F49BE15716341E",
 	collection: "0x1dfE8adcd3952e2ab345B403141E357adC493AA8"
}

class Oracle implements OracleApiDef {

    _homedir = require("os").homedir();

    _artifacts_dir = ".artifacts";

    _erc721AbiPath = path.join(this._homedir, this._artifacts_dir, "Rarible.json");
    _erc721Content = fs.readFileSync(this._erc721AbiPath, 'utf8');
    _erc721Metadata = JSON.parse(this._erc721Content);

    _transferAbiPath = path.join(this._homedir, this._artifacts_dir, "Transfer.json");
    _transferContent = fs.readFileSync(this._transferAbiPath, 'utf8');
    _transferMetadata = JSON.parse(this._transferContent);

    async getCollectionAddress(type: string): Promise<any> {
        return config.collection
//     	return type === "ERC721" ? "0xF6793dA657495ffeFF9Ee6350824910Abc21356C" : "0x1AF7A7555263F275433c6Bb0b8FdCD231F89B1D7"
    }

    async createForm(web3: any, ipfs: any, creator: any, tokenId: any, nftOwner: any): Promise<any> {
        return {
            "@type": "ERC721",
            contract: this.getCollectionAddress("ERC721"),
            tokenId: tokenId,
            uri: ipfs,
            creators: [{ account: creator, value: "10000" }],
            royalties: [{ account: nftOwner, value: "1000" }],
        }
    }

    DOMAIN_TYPE = [
      {
        type: "string",
        name: "name"
      },
      {
        type: "string",
        name: "version"
      },
      {
        type: "uint256",
        name: "chainId"
      },
      {
        type: "address",
        name: "verifyingContract"
      }
    ];

    async createTypeData(
      domainData: any,
      primaryType: any,
      message: any,
      types: any
    ): Promise<any> {
      return {
        types: Object.assign(
          {
            EIP712Domain: this.DOMAIN_TYPE
          },
          types
        ),
        domain: domainData,
        primaryType: primaryType,
        message: message
      };
    }


    async extractAddress(privateKey: any): Promise<any> {
      return `0x${privateToAddress(Buffer.from(privateKey, "hex")).toString("hex")}`
    }

    async signTypedData(web3: any, privateKey: any, from: any, data: any): Promise<any> {
        const account = await web3.utils.toChecksumAddress(await this.extractAddress(privateKey))
        if (from != account) {
          throw new Error("account error")
        }
        return await signTypedData_v4(Buffer.from(privateKey, "hex"), { data })
    }

    ERC721Types = {
        Part: [
            {name: 'account', type: 'address'},
            {name: 'value', type: 'uint96'}
        ],
        Mint721: [
            {name: 'tokenId', type: 'uint256'},
            {name: 'tokenURI', type: 'string'},
            {name: 'creators', type: 'Part[]'},
            {name: 'royalties', type: 'Part[]'}
        ]
    };

    async signLazyMintMessage(
        web3: any,
    	form: any,
    	account: any,
    	privateKey: any,
    	chainId: any,
    	verifyingContract: any
    ): Promise<any> {
        if (form["@type"] != "ERC721") {
            return Promise.resolve("It's not ERC721");
        }
    	const typeName = "Mint721"
    	const data = await this.createTypeData(
    		{
    			name: typeName,
    			version: "1",
    			chainId,
    			verifyingContract
    		},
    		typeName,
    		{ ...form, tokenURI: form.uri },
    		this.ERC721Types
    	);
    	console.log("signing", data)
        const res = await this.signTypedData(web3, privateKey, account, data);
        console.log("signature", res)
        return res
    }

    async makeSign(web3: any, form: any, password: any): Promise<any> {
        return await this.signLazyMintMessage(
            web3,
            form,
            form.creators[0].account,
            password,
            config.chainId,
            await this.getCollectionAddress(form["@type"])
        );
    }

    async signForMint(web3: any, password: any, ipfs: any, nftTokenId: any, nftOwner: any): Promise<any> {
        const [creator] = await web3.eth.getAccounts()
        const form = await this.createForm(web3, ipfs, creator, nftTokenId, nftOwner)
        const signed = await this.makeSign(web3, form, password)
        return signed
    }

    async make_signature(password: string, ipfs: string, nftTokenId: string, nftOwner: string): Promise<any> {
        const webSocketProvider = new Web3.providers.WebsocketProvider(config.ropstenWss);
        const maker = new HDWalletProvider(password, webSocketProvider);
        const web3 = new Web3(maker);
        const accounts = await web3.eth.getAccounts();
        let signature = await this.signForMint(web3, password, ipfs, nftTokenId, nftOwner)
        console.log("Final signature: " + signature)
        return signature
    }

    async extractLastEventFrom(): Promise<any> {
        const maker = new Web3.providers.WebsocketProvider(config.rinkebyWss);
        const web3 = new Web3(maker);
        const accounts = await web3.eth.getAccounts();

        let contract = new web3.eth.Contract(this._transferMetadata.abi, config.bridgeSenderContract);
        console.log("start listen bridgeSenderContract");

        const tx = contract.getPastEvents('TryCrossChainTransfer',  {fromBlock: 0, toBlock: 'latest'});

        console.log("end listen bridgeSenderContract");

        let result = await Promise.resolve(tx);

        console.log("target event", result.at(-1));

        return result.at(-1)
    }

    async extractTargetEventToErcImpl(tokenId: string, ownerId: string): Promise<any> {
        const maker = new Web3.providers.WebsocketProvider(config.ropstenWss);
        const web3 = new Web3(maker);
        const accounts = await web3.eth.getAccounts();

        let contract = new web3.eth.Contract(this._erc721Metadata.abi, config.collection);

        const tx = contract.getPastEvents('Transfer',  {fromBlock: 0, toBlock: 'latest'});

        console.log("end listen");

        let result = await Promise.resolve(tx);

        let goodEvent = null;
        for (let i = 0; i < result.length; i++) {
            let event = result.at(i)
            if (event?.returnValues._from === config.oracleAddress &&
                event?.returnValues._to === ownerId &&
                event?.returnValues._tokenId === tokenId
            ) {
                console.log("found transaction: " + event);
                goodEvent = event;
                break;
            }
        }

        return goodEvent;
    }


    async isTransferPerformed(nftToken: string, nftOwner: string): Promise<any> {
        let event = await this.extractTargetEventToErcImpl(nftToken, nftOwner);
        if (event === null || typeof event === undefined) {
            return false;
        }
        return true;
    }

    async callMintAndTransferAtTargetChain(password: any, nftTokenId: string, nftOwner: string, nftURI: string): Promise<any> {
//         const maker = new Web3.providers.WebsocketProvider(config.ropstenWss);
//         const web3 = new Web3(maker);
        const maker = new HDWalletProvider(password, config.ropstenRpc)
        const web3 = new Web3(maker)
        const accounts = await web3.eth.getAccounts();

        let signature = await this.make_signature(password, nftURI, nftTokenId, nftOwner);
        let creators = [{account: config.oracleAddress, value: "10000"}]
        let royalties = [{account: nftOwner, value: "1000"}]
        let data = {
            tokenId: nftTokenId,
            tokenURI: nftURI,
            creators: creators,
            royalties: royalties,
            signatures: [signature]}
        let raribleNftCollecton = new web3.eth.Contract(this._erc721Metadata.abi, config.collection)
        console.log("oracle start mintAndTransfer");
        let tx = await raribleNftCollecton.methods.mintAndTransfer(data, nftOwner).send({
        from: config.oracleAddress, gas: 1500000, gasPrice: '30000000000'})
        console.log("oracle mintAndTransfer tx - " + tx);
        return tx.toString()
    }

    async oracle(password: string): Promise<any> {
        let lastEventRinkeby = await this.extractLastEventFrom();
        let nftToken = lastEventRinkeby?.returnValues.nftToken;
        let nftOwner = lastEventRinkeby?.returnValues.nftOwner;
        let nftURI = lastEventRinkeby?.returnValues.nftURI
        console.log("NFT info, token - " + nftToken + ", owner - " + nftOwner + ", uri - " + nftURI);
        let isTransferAlreadyPerformed = await this.isTransferPerformed(nftToken, nftOwner)
        if (isTransferAlreadyPerformed) {
            console.log("No pending transactions");
            return Promise.resolve("OK");
        }
        let tx = await this.callMintAndTransferAtTargetChain(password, nftToken, nftOwner, nftURI);
        console.log("Performed transaction" + tx);
        return Promise.resolve("OK");
    }

    async load_contract(password: string): Promise<any> {
        const maker = new Web3.providers.WebsocketProvider(config.rinkebyWss);
        const web3 = new Web3(maker);
        const accounts = await web3.eth.getAccounts();

        let contract = new web3.eth.Contract(this._erc721Metadata.abi, config.bridgeSenderContract);
        console.log("start get events from bridgeSenderContract");

        const tx = contract.getPastEvents('TryCrossChainTransfer',  {fromBlock: 0, toBlock: 'latest'});

        console.log("end get events from bridgeSenderContract");

        let result = await Promise.resolve(tx);

        console.log("target event", result.length, result.at(-1));

        return result.at(-1);
    }
}

async function main() {

    await Fluence.start({
        connectTo: krasnodar[5],
        /*
        connectTo: {
            multiaddr: "/ip4/127.0.0.1/tcp/9990/ws/p2p/12D3KooWHBG9oaVx4i3vi6c1rSBUm7MLBmyGmmbHoZ23pmjDCnvK",
            peerId: "12D3KooWHBG9oaVx4i3vi6c1rSBUm7MLBmyGmmbHoZ23pmjDCnvK"
        },
        */
    });

    console.log("PeerId: ", Fluence.getStatus().peerId);
    console.log("Relay id: ", Fluence.getStatus().relayPeerId);

    registerOracleApi("oracle", new Oracle());

    console.log("ctrl-c to exit");

    // await Fluence.stop();
}

main();

