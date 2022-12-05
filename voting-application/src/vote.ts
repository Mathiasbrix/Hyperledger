/*
  SPDX-License-Identifier: Apache-2.0
*/

import {Object, Property} from 'fabric-contract-api';
import { Party } from './interfaces';

@Object()
export class Vote {
    @Property()
    public id: string;

    @Property()
    public vote: string;

    @Property()
    public timestamp: string;
}