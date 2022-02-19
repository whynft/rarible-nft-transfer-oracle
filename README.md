
```bash
cd oracle
```


### Running And Interacting With The Fluence Peer

Open two terminal windows in the `~/src/oracle/` directory to launch the peer and a client peer, respectively. Please note that you can use the peer with a local Fluence node or the testnet. For our purposes, we will be using Fluence's `krasnodar` testnet.

Install the dependencies with:

```bash
# setup the node
npm i
```

Then compile Aqua:

```bash
# compile aqua
npm run compile-aqua
```

You can check the generated Typescript and AIR code in the `src/_aqua` directory. With our setup complete, let's start the peer:

```bash
# start the node
npm start
````

Please take note of the **relay id** and **peer id** for use in your client peer. In order to call the `oracle` method, open a new terminal window and navigate to the `~/src/oracle` directory and execute:

```bash
bash oracle/run.sh
```

