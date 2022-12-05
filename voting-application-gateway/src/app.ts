/*
 * Copyright IBM Corp. All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import * as grpc from '@grpc/grpc-js';
import { connect, Contract, Identity, Signer, signers } from '@hyperledger/fabric-gateway';
import * as crypto from 'crypto';
import { promises as fs } from 'fs';
import * as path from 'path';
import { TextDecoder } from 'util';

const channel1Name = envOrDefault('CHANNEL_NAME', 'channel1');
const channel2Name = envOrDefault('CHANNEL_NAME', 'channel2');
const chaincodeVoteName = envOrDefault('CHAINCODE_NAME', 'voting-application');
const chaincodeEligibilityName = envOrDefault('CHAINCODE_NAME', 'eligibility-service');
const mspId = envOrDefault('MSP_ID', 'Org1MSP');

// Path to crypto materials.
const cryptoPath = envOrDefault('CRYPTO_PATH', path.resolve(__dirname, '..', '..', '..', 'go','src','github.com','mathiasbrix','fabric-samples','test-network', 'organizations', 'peerOrganizations', 'org1.example.com'));

// Path to user private key directory.
const keyDirectoryPath = envOrDefault('KEY_DIRECTORY_PATH', path.resolve(cryptoPath, 'users', 'User1@org1.example.com', 'msp', 'keystore'));

// Path to user certificate.
const certPath = envOrDefault('CERT_PATH', path.resolve(cryptoPath, 'users', 'User1@org1.example.com', 'msp', 'signcerts', 'cert.pem'));

// Path to peer tls certificate.
const tlsCertPath = envOrDefault('TLS_CERT_PATH', path.resolve(cryptoPath, 'peers', 'peer0.org1.example.com', 'tls', 'ca.crt'));

// Gateway peer endpoint.
const peerEndpoint = envOrDefault('PEER_ENDPOINT', 'localhost:7051');

// Gateway peer SSL host name override.
const peerHostAlias = envOrDefault('PEER_HOST_ALIAS', 'peer0.org1.example.com');

const voterId= crypto.randomUUID();
const existingVoterId = "5034c2e3-a3f6-4283-b272-6929f86b0cf5";
const voteId= crypto.randomUUID();

const utf8Decoder = new TextDecoder();

async function main(): Promise<void> {

    await displayInputParameters();

    // The gRPC client connection should be shared by all Gateway connections to this endpoint.
    const client = await newGrpcConnection();

    const gateway = connect({
        client,
        identity: await newIdentity(),
        signer: await newSigner(),
        // Default timeouts for different gRPC calls
        evaluateOptions: () => {
            return { deadline: Date.now() + 5000 }; // 5 seconds
        },
        endorseOptions: () => {
            return { deadline: Date.now() + 15000 }; // 15 seconds
        },
        submitOptions: () => {
            return { deadline: Date.now() + 5000 }; // 5 seconds
        },
        commitStatusOptions: () => {
            return { deadline: Date.now() + 60000 }; // 1 minute
        },
    });

    try {
        // Get a network instance representing the channel where the smart contract is deployed.
        const channel1 = gateway.getNetwork(channel1Name);
        const channel2 = gateway.getNetwork(channel2Name);

        // Get the smart contract from the network.
        const votingContract = channel1.getContract(chaincodeVoteName);
        const Eligibilitycontract = channel2.getContract(chaincodeEligibilityName);

        // Init ledger on channel2
        await initEligibilityLeder(Eligibilitycontract);

        // Return all the current assets on the ledger.
        await createVote(votingContract);

        // Update an existing asset asynchronously.
        await getAllVotes(votingContract);

        // Update an existing asset asynchronously.
        await getAllVoters(Eligibilitycontract);
        // Try to create existing vote.
        await createExistingVote(votingContract);
    } finally {
        gateway.close();
        client.close();
    }
}

main().catch(error => {
    console.error('******** FAILED to run the application:', error);
    process.exitCode = 1;
});

async function newGrpcConnection(): Promise<grpc.Client> {
    const tlsRootCert = await fs.readFile(tlsCertPath);
    const tlsCredentials = grpc.credentials.createSsl(tlsRootCert);
    return new grpc.Client(peerEndpoint, tlsCredentials, {
        'grpc.ssl_target_name_override': peerHostAlias,
    });
}

async function newIdentity(): Promise<Identity> {
    const credentials = await fs.readFile(certPath);
    return { mspId, credentials };
}

async function newSigner(): Promise<Signer> {
    const files = await fs.readdir(keyDirectoryPath);
    const keyPath = path.resolve(keyDirectoryPath, files[0]);
    const privateKeyPem = await fs.readFile(keyPath);
    const privateKey = crypto.createPrivateKey(privateKeyPem);
    return signers.newPrivateKeySigner(privateKey);
}

/**
 * Get all votes in the state. Used for auditing.
 */
async function getAllVotes(contract: Contract): Promise<void> {
    console.log('\n--> Evaluate Transaction: GetAllVotes, function returns all the current votes on the ledger.');

    const resultBytes = await contract.evaluateTransaction('GetAllVotes');

    const resultJson = utf8Decoder.decode(resultBytes);
    const result = JSON.parse(resultJson);
    console.log('*** Result:', result);
}

/**
 * Creates a vote with an id, party, timestamp and voterId
 */
async function createVote(contract: Contract): Promise<void> {
    console.log('\n--> Submit Transaction: CreateVote, creates new vote with party');

    await contract.submitTransaction(
        'CreateVote',
        voteId,
        'A',
        String(Date.now()),
        existingVoterId,
    );

    console.log('*** Transaction committed successfully');
}

/**
 * Attempts to create a vote with an already existing id. Should return an error.
 */
async function createExistingVote(contract: Contract): Promise<void> {
    console.log('\n--> Submit Transaction: CreateVote, tries to create same vote multiple times, should return an error');

    try {
    await contract.submitTransaction(
        'CreateVote',
        voteId,
        'A',
        String(Date.now()),
        existingVoterId,
    );
        console.log('******** FAILED to return an error');
    } catch (error) {
        console.log('*** Successfully caught the error: \n');
    }
}

/**
 * Get all voters. Used for auditing.
 */
async function getAllVoters(contract: Contract): Promise<void> {
    console.log('\n--> Evaluate Transaction: GetAllVoters, function returns all the current voters on the ledger.');

    const resultBytes = await contract.evaluateTransaction('GetAllVoters');

    const resultJson = utf8Decoder.decode(resultBytes);
    const result = JSON.parse(resultJson);
    console.log('*** Result:', result);
}
/**
 * envOrDefault() will return the value of an environment variable, or a default value if the variable is undefined.
 */
function envOrDefault(key: string, defaultValue: string): string {
    return process.env[key] || defaultValue;
}

/**
 * displayInputParameters() will print the global scope parameters used by the main driver routine.
 */
async function displayInputParameters(): Promise<void> {
    console.log(`channelName:       ${channel1Name}`);
    console.log(`chaincodeName:     ${chaincodeVoteName}`);
    console.log(`mspId:             ${mspId}`);
    console.log(`cryptoPath:        ${cryptoPath}`);
    console.log(`keyDirectoryPath:  ${keyDirectoryPath}`);
    console.log(`certPath:          ${certPath}`);
    console.log(`tlsCertPath:       ${tlsCertPath}`);
    console.log(`peerEndpoint:      ${peerEndpoint}`);
    console.log(`peerHostAlias:     ${peerHostAlias}`);
}

async function initEligibilityLeder(contract: Contract) {
    console.log('\n--> Submit Transaction: InitLedger, Initializes eligibility service ledger with voter data.');

    await contract.submitTransaction(
        'InitLedger'
        );
    console.log('*** Transaction committed successfully');
}
