/*
  SPDX-License-Identifier: Apache-2.0
*/

import {Object, Property} from 'fabric-contract-api';

@Object()
export class Voter {
    @Property()
    public id: string;

    @Property()
    public name: string;

    @Property()
    public SSN: string;

    @Property()
    public region: string;
}