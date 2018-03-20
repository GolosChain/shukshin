import {EventEmitter} from 'events';
import {Observable} from 'rxjs';
import PersistentWebSocket from '../transport/WebSocket/Persistent';
import Queue from '../../queue/tarantool/Queue';
import Operation from '../chain/operation';

export default class Golos extends EventEmitter {
  socket; // rpc
  block; // current processing block
  requestTransactions(block) {
    this.socket.send(
      // golos api
      JSON.stringify({
        id: 2,
        method: 'call',
        params: ['database_api', 'get_ops_in_block', [block, 'false']],
      })
    );
  }
  setBlockAppliedCallback() {
    this.socket.send(
      // golos api
      JSON.stringify({
        id: 1,
        method: 'call',
        'params': ['database_api', 'set_block_applied_callback', [0]],
      })
    );
  }
  // the sequence of socket openings
  get opens() {
    return Observable
      .fromEvent(this.socket, 'open')
      .do(
        socketEvent => {
          // ...set a block application callback immediately
          this.setBlockAppliedCallback();
          console.log('[x][open] set_block_applied_callback');
        }
      );
  }
  // the sequence of raw socket messages
  get messages() {
    return Observable
      .fromEvent(this.socket, 'message')
      // todo make this an rx operator
      .map(dataEvent => JSON.parse(dataEvent.data))
      .catch(e => {
        // todo throw something custom here
        console.log('Error parsing raw data!');
        return Observable.empty();
      });
  }
  // the sequence of the applied block structs (result of setBlockAppliedCallback)
  get pulse() {
    return this.messages
      .filter(data => (data.method === 'notice' && data.params))
      .map(blockData => blockData.params[1][0])
      .map(blockData => ({
        // calculate and add the current block's number (chain head) for convenience
        index: parseInt(blockData.previous.slice(0, 8), 16) + 1,
        ...blockData
      }))
      .do(
        block => {
          if (!this.block) {
          // the next block is ready to be composed
          // save the initial state
            this.block = block;
            console.log(block.index)
            // request transactions
            this.requestTransactions(block.index);
            //  track transactions for this block in transactions stream
          }
        });
  }
  // produce operations array for current processing block
  get operations() {
    return this.messages
      .filter(message => message.id === 2)
      .map(message => message.result)
      .map(transactions =>
        transactions
          .map(
            trx => {
              const {op} = trx;
              const type = op[0];
              const data = op[1];
              return {type, data};
            }
          )
          // process only implemented operations
          .filter(operation => Operation.implemented(operation))
          // transform each operation into the special class instance
          .map(operation => Operation.instance(operation))
      )
      .do(operations => {
        // got a requested array of transactions for block this.block
        // compose block struct
        const block = {
          operations,
          ...this.block
        };
        // block structure is composed - emit
        this.emit('block', block);
        // allow the next block processing
        this.block = null;
      }
      );
  }
  // produce the sequence of composed blocks
  get blocks() {
    return Observable
      .fromEvent(this, 'block');
  }
  //
  constructor() {
    super();
    // a persistent websocket instance implementing WebSocket interface
    this.socket = new PersistentWebSocket('wss://ws.golos.io');
    // nothing's being processed right now
    this.block = null;
    // make streams live
    this.opens.subscribe();
    this.pulse.subscribe();
    this.operations.subscribe();
  }
}
