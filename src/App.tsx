import React, {
  useCallback, useEffect, useMemo, useState,
} from 'react';
import { Provider, Signer } from '@acala-network/bodhi';
import { WsProvider } from '@polkadot/api';
import { web3Enable } from '@polkadot/extension-dapp';
import type {
  InjectedExtension,
  InjectedAccount,
} from '@polkadot/extension-inject/types';
import { ContractFactory, Contract } from 'ethers';
import { formatUnits } from 'ethers/lib/utils';
import { Input, Button, Select } from 'antd';
import profileContract from './abi/ProfileImage.json';
import ticketContract from './abi/TicketFactory.json'

import './App.scss';

const { Option } = Select;

const Check = () => (<span className='check'>✓</span>);

function App() {
  /* ---------- extensions ---------- */
  const [extensionList, setExtensionList] = useState<InjectedExtension[]>([]);
  const [curExtension, setCurExtension] = useState<InjectedExtension | undefined>(undefined);
  const [accountList, setAccountList] = useState<InjectedAccount[]>([]);

  /* ---------- status flags ---------- */
  const [connecting, setConnecting] = useState(false);
  const [loadingAccount, setLoadingAccountInfo] = useState(false);
  const [pdeploying, setPDeploying] = useState(false);
  const [tdeploying, setTDeploying] = useState(false);
  const [calling, setCalling] = useState(false);

  /* ---------- data ---------- */
  const [provider, setProvider] = useState<Provider | null>(null);
  const [selectedAddress, setSelectedAddress] = useState<string>('');
  const [claimedEvmAddress, setClaimedEvmAddress] = useState<string>('');
  const [balance, setBalance] = useState<string>('');
  const [profileDeployedAddress, setProfileDeployedAddress] = useState<string>('');
  const [ticketDeployedAddress, setTicketDeployedAddress] = useState<string>('');
  const [echoInput, setEchoInput] = useState<string>('calling an EVM+ contract with polkadot wallet!');
  const [echoMsg, setEchoMsg] = useState<string>('');
  const [newEchoMsg, setNewEchoMsg] = useState<string>('');
  const [url, setUrl] = useState<string>('wss://mandala-rpc.aca-staging.network/ws');
  // const [url, setUrl] = useState<string>('ws://localhost:9944');

  /* ------------ Step 1: connect to chain node with a provider ------------ */
  const connectProvider = useCallback(async (nodeUrl: string) => {
    setConnecting(true);
    try {
      const signerProvider = new Provider({
        provider: new WsProvider(nodeUrl.trim()),
      });

      await signerProvider.isReady();

      setProvider(signerProvider);
    } catch (error) {
      console.error(error);
      setProvider(null);
    } finally {
      setConnecting(false);
    }
  }, []);

  /* ------------ Step 2: connect polkadot wallet ------------ */
  const connectWallet = useCallback(async () => {
    connectProvider(url);
    const allExtensions = await web3Enable('bodhijs-example');
    setExtensionList(allExtensions);
    setCurExtension(allExtensions[0]);
  }, []);

  useEffect(() => {
    curExtension?.accounts.get().then(result => {
      setAccountList(result);
      setSelectedAddress(result[0].address || '');
    });
  }, [curExtension]);

  /* ----------
     Step 2.1: create a bodhi signer from provider and extension signer
                                                             ---------- */
  const signer = useMemo(() => {
    if (!provider || !curExtension || !selectedAddress) return null;
    return new Signer(provider, selectedAddress, curExtension.signer);
  }, [provider, curExtension, selectedAddress]);

  /* ----------
     Step 2.2: locad some info about the account such as:
     - bound/default evm address
     - balance
     - whatever needed
                                               ---------- */
  useEffect(() => {
    (async function fetchAccountInfo() {
      if (!signer) return;

      setLoadingAccountInfo(true);
      try {
        const [evmAddress, accountBalance] = await Promise.all([
          signer.queryEvmAddress(),
          signer.getBalance(),
        ]);
        setBalance(formatUnits(accountBalance));
        setClaimedEvmAddress(evmAddress);
      } catch (error) {
        console.error(error);
        setClaimedEvmAddress('');
        setBalance('');
      } finally {
        setLoadingAccountInfo(false);
      }
    }());
  }, [signer]);

  /* ------------ Step 3: deploy contract ------------ */
  const deployProfile = useCallback(async () => {
    if (!signer) return;

    setPDeploying(true);
    try {
      const factory = new ContractFactory(profileContract.output.abi, profileContract.bytecode, signer);

      const contract = await factory.deploy();
      const echo = await contract.profileImage();

      setProfileDeployedAddress(contract.address);
    } finally {
      setPDeploying(false);
    }
  }, [signer]);

  const deployTicket = useCallback(async () => {
    if (!signer) return;

    setTDeploying(true);
    try {
      const factory = new ContractFactory(ticketContract.output.abi, ticketContract.bytecode, signer);

      const contract = await factory.deploy();
      const echo = await contract.ticket();

      setTicketDeployedAddress(contract.address);
    
    } finally {
      setTDeploying(false);
    }
  }, [signer]);

  /* ------------ Step 4: call contract ------------ */
  // const callContract = useCallback(async (msg: string) => {
  //   if (!signer) return;
  //   setCalling(true);
  //   setNewEchoMsg('');
  //   try {
  //     const instance = new Contract(deployedAddress, echoContract.abi, signer);

  //     await instance.scream(msg);
  //     const newEcho = await instance.echo();

  //     setNewEchoMsg(newEcho);
  //   } finally {
  //     setCalling(false);
  //   }
  // }, [signer, deployedAddress]);

  // eslint-disable-next-line
  const ExtensionSelect = () => (
    <div className='step-text'>
      <span style={{ marginRight: 10 }}>select a polkadot wallet:</span>
      <Select
        value={ curExtension?.name }
        onChange={ targetName => setCurExtension(extensionList.find(e => e.name === targetName)) }
        disabled={ !!profileDeployedAddress || !!ticketDeployedAddress}
      >
        {extensionList.map(ex => (
          <Option key={ ex.name } value={ ex.name }>
            {`${ex.name}/${ex.version}`}
          </Option>
        ))}
      </Select>
    </div>
  );

  // eslint-disable-next-line
  const AccountSelect = () => (
    <div>
      <span style={{ marginRight: 10 }}>account:</span>
      <Select
        value={ selectedAddress }
        onChange={ value => setSelectedAddress(value) }
        disabled={ !!profileDeployedAddress || !!ticketDeployedAddress }
      >
        {accountList.map(account => (
          <Option key={ account.address } value={ account.address }>
            {account.name} / {account.address}
          </Option>
        ))}
      </Select>
    </div>
  );

  return (
    <div id='app'>
      <header>
      <div className="logo-container">
        <img src='./img/logo_w_text.png' alt="Logo" className="logo" />
      </div>
    </header>
      <div className='card'>
        <section className='step'>
          <div className='step-text'>Connect Polkadot Wallet {signer && <Check />}</div>
          <div>
            <Button
              type='primary'
              onClick={connectWallet}
              // disabled={ !provider || !!signer }
            >
              {curExtension
                ? `Connected to ${curExtension.name}/${curExtension.version}`
                : 'Connect'}
            </Button>
  
            {!!extensionList?.length && <ExtensionSelect />}
            {!!accountList?.length && <AccountSelect />}
          </div>
  
          {signer && (
            <div>
              {loadingAccount
                ? 'Loading account info...'
                : claimedEvmAddress
                ? (
                    <div className='step-text'>
                      Claimed EVM address: <span className='address'>{claimedEvmAddress}</span>
                    </div>
                  )
                : (
                    <div className='step-text'>
                      Default EVM address: <span className='address'>{signer.computeDefaultEvmAddress()}</span>
                    </div>
                  )}
              {balance && (
                <div className='step-text'>
                  Account balance: <span className='address'>{balance}</span>
                </div>
              )}
            </div>
          )}
        </section>
      
  
      
        <section className='step'>
          <div className='step-text'>Deploy ProfileImage Contract {profileDeployedAddress && <Check />}</div>
          <Button
            type='primary'
            disabled={!signer || pdeploying || !!profileDeployedAddress}
            onClick={deployProfile}
          >
            {profileDeployedAddress
              ? 'Contract deployed'
              : pdeploying
              ? 'Deploying...'
              : 'Deploy'}
          </Button>
  
          {profileDeployedAddress && (
            <div>
              Contract address: <span className='address'>{profileDeployedAddress}</span>
            </div>
          )}
        </section>
      
  
      
        <section className='step'>
          <div className='step-text'>Deploy Ticket Contract {ticketDeployedAddress && <Check />}</div>
          <Button
            type='primary'
            disabled={!signer || tdeploying || !!ticketDeployedAddress}
            onClick={deployTicket}
          >
            {ticketDeployedAddress
              ? 'Contract deployed'
              : tdeploying
              ? 'Deploying...'
              : 'Deploy'}
          </Button>
  
          {ticketDeployedAddress && (
            <div>
              Contract address: <span className='address'>{ticketDeployedAddress}</span>
            </div>
          )}
        </section>
      </div>
    </div>
  );
  
}

export default App;
