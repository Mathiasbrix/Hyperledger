/*
 * SPDX-License-Identifier: Apache-2.0
 */
// Deterministic JSON.stringify()
import {Context, Contract, Info, Returns, Transaction} from 'fabric-contract-api';
import { Voter } from './voter';
import stringify from 'json-stringify-deterministic';
import sortKeysRecursive from 'sort-keys-recursive';

@Info({title: 'Voting-Application', description: 'Smart contract voting application'})
export class EligibilityServiceContract extends Contract {

    //Initializes the ledger with test data(Voters)
    @Transaction()
    public async InitLedger(ctx: Context): Promise<void> {
        const voters: Voter[] = [
            {
                id: "5034c2e3-a3f6-4283-b272-6929f86b0cf5",
                name: 'John Doe',
                SSN: '534214-1222',
                region: 'Sjælland',
                hasVoted: false
            },
            {
                id: "883a9a29-6538-4b4f-b024-920a43fe97f2",
                name: 'John Deer',
                SSN: '291212-1235',
                region: 'Sjælland',
                hasVoted: false
            },
            {
                id: "5d608099-5031-4a04-aa5e-969e43a1e4fe",
                name: 'John Dej',
                SSN: '537788-3345',
                region: 'Syddanmark',
                hasVoted: false
            },
            {
                id: "6e8af1f4-9489-41c5-beb8-bcaf9a54f1c0",
                name: 'John Deep',
                SSN: '123456-1114',
                region: 'Østjylland',
                hasVoted: false
            },
            {
                id: "b9f38e74-824e-4786-8c7c-b62676957888",
                name: 'John Deop',
                SSN: '123542-5234',
                region: 'Sjælland',
                hasVoted: false
            },
            {
                id: "afe037b7-f29c-488f-b198-c46d936bfcc2",
                name: 'John Depp',
                SSN: '294523-3235',
                region: 'Nordjylland',
                hasVoted: false
            },
        ];

        for (const voter of voters) {
            await ctx.stub.putState(voter.id, Buffer.from(stringify(sortKeysRecursive(voter))));
        }
    }

    // Gets a Voter from the world state and updates hasVoted to true.
    @Transaction()
    public async SetHasVoted(ctx: Context, voterId: string): Promise<void> {
        const assetArray = await ctx.stub.getState(voterId);

        const jsonString = Buffer.from(assetArray).toString('utf8')

        const voter: Voter = JSON.parse(jsonString)

        voter.hasVoted = true;

        await ctx.stub.putState(voter.id, Buffer.from(stringify(sortKeysRecursive(voter))));
    }

    // Returns all voters found in the world state, used for auditing.
    @Transaction(false)
    @Returns('string')
    public async GetAllVoters(ctx: Context): Promise<string> {
        const votes = [];

        const iterator = await ctx.stub.getStateByRange("", "")
        let result = await iterator.next();
        while (!result.done) {
            const str = Buffer.from(result.value.value.toString()).toString('utf8');
            let record;
            try {
                record = JSON.parse(str);
            } catch (err) {
                console.log(err);
                record = str;
            }
            votes.push(record);
            result = await iterator.next();
        }
        return JSON.stringify(votes);
    }

    // VoterExists returns true when voter with given ID exists in world state.
    @Transaction(false)
    @Returns('boolean')
    public async VoterExists(ctx: Context, id: string): Promise<boolean> {
        const assetJSON = await ctx.stub.getState(id);
        return assetJSON && assetJSON.length > 0;
    }

    // VoterHasVoted returns true when voter with given ID has already voted.
    @Transaction(false)
    @Returns('boolean')
    public async VoterHasVoted(ctx: Context, id: string): Promise<boolean> {
        const assetArray = await ctx.stub.getState(id);

        const jsonString = Buffer.from(assetArray).toString('utf8')

        const parsedData = JSON.parse(jsonString)
        
        const voter: Voter = parsedData

        return voter.hasVoted;
    }
}

