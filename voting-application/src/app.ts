/*
 * SPDX-License-Identifier: Apache-2.0
 */
// Deterministic JSON.stringify()
import {Context, Contract, Info, Returns, Transaction} from 'fabric-contract-api';
import { Vote } from './vote';
import { Voter } from './voter';
import stringify from 'json-stringify-deterministic';
import sortKeysRecursive from 'sort-keys-recursive';

@Info({title: 'Voting-Application', description: 'Smart contract voting application'})
export class VoteApplicationContract extends Contract {

    //Create a vote in the world state
    @Transaction()
    public async CreateVote(ctx: Context, id: string, vote: string, timestamp: string, voterId: string): Promise<void> {
        
        this.VoterExists(ctx, voterId);

        this.VoterHasVoted(ctx, id)

        const voteObject: Vote = {
            id: id,
            vote: vote,
            timestamp: timestamp,
        };
        // we insert data in alphabetic order using 'json-stringify-deterministic' and 'sort-keys-recursive'
        await ctx.stub.putState(voteObject.id, Buffer.from(stringify(sortKeysRecursive(voteObject))));

        await ctx.stub.invokeChaincode("eligibility-service", ['SetHasVoted', voterId], "channel2")
    }

    // Returns all votes found in the world state, used for auditing.
    @Transaction(false)
    @Returns('string')
    public async GetAllVotes(ctx: Context): Promise<string> {
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

    //Checks if a given voter exists in the state.
    public async VoterExists(ctx: Context, voterId: string): Promise<void> {
        const response = await ctx.stub.invokeChaincode("eligibility-service", ['VoterExists', voterId], "channel2")

        if (response.status !== 200) {
            throw new Error(response.message);
        }
        const voterExists = JSON.parse(response.payload.toString());

        if (!voterExists) {
            throw new Error(`The user does not exist`);
        }
    }

    //Checks if the voter has already voted.
    public async VoterHasVoted(ctx: Context, id: string): Promise<void> {
        const response = await ctx.stub.invokeChaincode("eligibility-service", ['VoterHasVoted', id], "channel2")

        if (response.status !== 200) {
            throw new Error(response.message);
        }
        const hasVoted = JSON.parse(response.payload.toString()).hasVoted;

        if (hasVoted) {
            throw new Error(`A vote has already been commited for this user.`);
        }
    }
}
