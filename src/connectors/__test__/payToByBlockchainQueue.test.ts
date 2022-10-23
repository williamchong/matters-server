import {
  BLOCKCHAIN,
  BLOCKCHAIN_CHAINID,
  BLOCKCHAIN_TRANSACTION_STATE,
  PAYMENT_CURRENCY,
  PAYMENT_PROVIDER,
  TRANSACTION_PURPOSE,
  TRANSACTION_REMARK,
  TRANSACTION_STATE,
  TRANSACTION_TARGET_TYPE,
} from 'common/enums'
import { environment, USDTContractAddress } from 'common/environment'
import { PaymentQueueJobDataError, UnknownError } from 'common/errors'
import { CurationContract } from 'connectors/blockchain'
import { payToByBlockchainQueue } from 'connectors/queue'
import { GQLChain } from 'definitions'

import { getQueueResult } from './utils'

// setup mock

const mockFetchLogs = jest.fn()
const mockFetchTxReceipt = jest.fn()
const mockFetchBlockNumber = jest.fn()
jest.mock('connectors/blockchain', () => {
  return {
    __esModule: true,
    CurationContract: jest.fn().mockImplementation(() => {
      return {
        fetchTxReceipt: mockFetchTxReceipt,
        fetchLogs: mockFetchLogs,
        fetchBlockNumber: mockFetchBlockNumber,
        chainId: BLOCKCHAIN_CHAINID.Polygon.PolygonMumbai,
        address: environment.curationContractAddress.toLowerCase(),
      }
    }),
  }
})

// test data
//
const curationContractAddress =
  environment.curationContractAddress.toLowerCase()
const zeroAdress = '0x0000000000000000000000000000000000000000'

const amount = 1
const state = TRANSACTION_STATE.pending
const purpose = TRANSACTION_PURPOSE.donation
const currency = PAYMENT_CURRENCY.USDT
const provider = PAYMENT_PROVIDER.blockchain
const invalidProviderTxId = '12345'
const recipientId = '1'
const senderId = '2'
const targetId = '1'
const targetType = TRANSACTION_TARGET_TYPE.article
const queue = payToByBlockchainQueue
const chain = BLOCKCHAIN.Polygon.valueOf() as GQLChain

const invalidTxhash =
  '0x209375f2de9ee7c2eed5e24eb30d0196a416924cd956a194e7060f9dcb39515b'
const failedTxhash =
  '0xbad52ae6172aa85e1f883967215cbdc5e70ddc479c7ee22da3c23d06820ee29e'
const txHash =
  '0x649cf52a3c7b6ba16e1d52d4fc409c9ca1307329e691147990abe59c8c16215c'

const invalidTxReceipt = {
  txHash: invalidTxhash,
  reverted: false,
  events: [],
}
const failedTxReceipt = {
  txHash: failedTxhash,
  reverted: true,
  events: [],
}
const validEvent = {
  curatorAddress: '0x999999cf1046e68e36e1aa2e0e07105eddd1f08f',
  creatorAddress: '0x999999cf1046e68e36e1aa2e0e07105eddd1f08e',
  uri: 'ipfs://someIpfsDataHash1',
  tokenAddress: USDTContractAddress,
  amount: '1000000000000000000',
}
const txReceipt = {
  txHash,
  reverted: false,
  events: [validEvent],
}

// tests

describe('payToByBlockchainQueue.payTo', () => {
  beforeAll(() => {
    queue.delay = 1
    mockFetchTxReceipt.mockClear()
    mockFetchTxReceipt.mockImplementation(async (hash: string) => {
      if (hash === invalidTxhash) {
        return invalidTxReceipt
      } else if (hash === failedTxhash) {
        return failedTxReceipt
      } else if (hash === txHash) {
        return txReceipt
      } else {
        return null
      }
    })
  })

  test('job with wrong tx id will fail', async () => {
    const wrongTxId = '12345'
    const job = await queue.payTo({ txId: wrongTxId })
    await expect(getQueueResult(queue.q, job.id)).rejects.toThrow(
      new PaymentQueueJobDataError('pay-to pending tx not found')
    )
    expect(await job.getState()).toBe('failed')
  })

  test('tx with wrong provier will fail', async () => {
    const tx = await queue.paymentService.createTransaction({
      amount,
      state,
      purpose,
      currency,
      provider: PAYMENT_PROVIDER.matters,
      providerTxId: invalidProviderTxId + '1',
      recipientId,
      senderId,
      targetId,
      targetType,
    })
    const job = await queue.payTo({ txId: tx.id })
    await expect(getQueueResult(queue.q, job.id)).rejects.toThrow(
      new PaymentQueueJobDataError('wrong pay-to queue')
    )
    expect(await job.getState()).toBe('failed')
  })

  test('tx with wrong providerTxId will fail', async () => {
    const tx = await queue.paymentService.createTransaction({
      amount,
      state,
      purpose,
      currency,
      provider,
      providerTxId: invalidProviderTxId + '2',
      recipientId,
      senderId,
      targetId,
      targetType,
    })
    const job = await queue.payTo({ txId: tx.id })
    await expect(getQueueResult(queue.q, job.id)).rejects.toThrow(
      new PaymentQueueJobDataError('blockchain transaction not found')
    )
    expect(await job.getState()).toBe('failed')
  })

  test('not mined tx will fail and retry', async () => {
    const tx =
      await queue.paymentService.findOrCreateTransactionByBlockchainTxHash({
        chain,
        txHash: 'fakeHash',
        amount,
        state,
        purpose,
        currency,
        recipientId,
        senderId,
        targetId,
        targetType,
      })
    const job = await queue.payTo({ txId: tx.id })
    await expect(getQueueResult(queue.q, job.id)).rejects.toThrow(
      new PaymentQueueJobDataError('blockchain transaction not mined')
    )
    expect(await job.getState()).toBe('active')
  })

  test('failed blockchain transation will mark transaction and blockchainTx as failed', async () => {
    const tx =
      await queue.paymentService.findOrCreateTransactionByBlockchainTxHash({
        chain,
        txHash: failedTxhash,
        amount,
        state,
        purpose,
        currency,
        recipientId,
        senderId,
        targetId,
        targetType,
      })
    const job = await queue.payTo({ txId: tx.id })
    expect(await getQueueResult(queue.q, job.id)).toStrictEqual({ txId: tx.id })
    const ret = await queue.paymentService.baseFindById(tx.id)
    expect(ret.state).toBe(TRANSACTION_STATE.failed)
    const blockchainTx = await queue.paymentService.baseFindById(
      tx.providerTxId,
      'blockchain_transaction'
    )
    expect(blockchainTx.state).toBe(BLOCKCHAIN_TRANSACTION_STATE.reverted)
  })

  test('succeeded invalid blockchain transaction will mark transaction as canceled', async () => {
    const tx =
      await queue.paymentService.findOrCreateTransactionByBlockchainTxHash({
        chain,
        txHash: invalidTxhash,
        amount,
        state,
        purpose,
        currency,
        recipientId,
        senderId,
        targetId,
        targetType,
      })
    const job = await queue.payTo({ txId: tx.id })
    expect(await getQueueResult(queue.q, job.id)).toStrictEqual({ txId: tx.id })
    const ret = await queue.paymentService.baseFindById(tx.id)
    expect(ret.state).toBe(TRANSACTION_STATE.canceled)
    expect(ret.remark).toBe(TRANSACTION_REMARK.INVALID)
    const blockchainTx = await queue.paymentService.baseFindById(
      tx.providerTxId,
      'blockchain_transaction'
    )
    expect(blockchainTx.state).toBe(BLOCKCHAIN_TRANSACTION_STATE.succeeded)
  })

  test('succeeded valid blockchain transaction will mark transaction and blockchainTx as succeeded', async () => {
    const tx =
      await queue.paymentService.findOrCreateTransactionByBlockchainTxHash({
        chain,
        txHash,
        amount,
        state,
        purpose,
        currency,
        recipientId,
        senderId: '10',
        targetId,
        targetType,
      })
    const job = await queue.payTo({ txId: tx.id })
    expect(await getQueueResult(queue.q, job.id)).toStrictEqual({ txId: tx.id })
    const ret = await queue.paymentService.baseFindById(tx.id)
    expect(ret.state).toBe(TRANSACTION_STATE.succeeded)
    const blockchainTx = await queue.paymentService.baseFindById(
      tx.providerTxId,
      'blockchain_transaction'
    )
    expect(blockchainTx.state).toBe(BLOCKCHAIN_TRANSACTION_STATE.succeeded)
  })
})

describe('payToByBlockchainQueue.syncCurationEvents', () => {
  const latestBlockNum = 30000128
  const safeBlockNum = 30000000
  const knex = queue.knex
  const txTable = 'transaction'
  const blockchainTxTable = 'blockchain_transaction'
  const eventTable = 'blockchain_curation_event'

  beforeAll(() => {
    mockFetchTxReceipt.mockImplementation(async (hash: string) => {
      if (hash === invalidTxhash) {
        return invalidTxReceipt
      } else if (hash === failedTxhash) {
        return failedTxReceipt
      } else if (hash === txHash) {
        return txReceipt
      } else {
        return null
      }
    })
    mockFetchLogs.mockImplementation(
      async (fromBlock?: number, toBlock?: number) => {
        return []
      }
    )
    mockFetchBlockNumber.mockReturnValue(Promise.resolve(latestBlockNum))
  })
  test('fetch all logs if no save point', async () => {
    const curation = new CurationContract()
    mockFetchLogs.mockClear()
    const [, newSavepoint] = await queue.fetchCurationLogs(curation, null)
    expect(mockFetchLogs).toHaveBeenCalledWith()
    expect(newSavepoint).toBe(latestBlockNum - 128)
  })
  test('fetch logs in limited block range if have save point', async () => {
    const curation = new CurationContract()

    const oldSavepoint1 = 20000000
    mockFetchLogs.mockClear()
    const [, newSavepoint1] = await queue.fetchCurationLogs(
      curation,
      oldSavepoint1
    )
    expect(mockFetchLogs).toHaveBeenCalledWith(oldSavepoint1 + 1, 20002000)
    expect(newSavepoint1).toBe(20002000)

    const oldSavepoint2 = 29999900
    mockFetchLogs.mockClear()
    const [, newSavepoint2] = await queue.fetchCurationLogs(
      curation,
      oldSavepoint2
    )
    expect(mockFetchLogs).toHaveBeenCalledWith(oldSavepoint2 + 1, safeBlockNum)
    expect(newSavepoint2).toBe(safeBlockNum)

    mockFetchLogs.mockClear()
    const [logs1, newSavepoint3] = await queue.fetchCurationLogs(
      curation,
      safeBlockNum - 1
    )
    expect(mockFetchLogs).not.toHaveBeenCalled()
    expect(logs1).toEqual([])
    expect(newSavepoint3).toBe(safeBlockNum - 1)

    mockFetchLogs.mockClear()
    const [logs2, newSavepoint4] = await queue.fetchCurationLogs(
      curation,
      safeBlockNum
    )
    expect(mockFetchLogs).not.toHaveBeenCalled()
    expect(logs2).toEqual([])
    expect(newSavepoint4).toBe(safeBlockNum)
  })
  test('handle empty logs', async () => {
    await queue.syncCurationEvents([])
  })
  test('removed logs will throw error', async () => {
    const removedLog = {
      txHash,
      address: curationContractAddress,
      blockNumber: 1,
      removed: true,
      event: validEvent,
    }
    await expect(queue.syncCurationEvents([removedLog])).rejects.toThrow(
      new UnknownError('unexpected removed logs')
    )
  })
  test('not matters logs will not update tx', async () => {
    await knex(txTable).del()
    await knex(blockchainTxTable).del()
    await knex(eventTable).del()
    const notMattersLogs = [
      {
        txHash: 'fakeTxhash1',
        address: curationContractAddress,
        blockNumber: 1,
        removed: false,
        event: {
          ...validEvent,
          curatorAddress: zeroAdress,
        },
      },
      {
        txHash: 'fakeTxhash2',
        address: curationContractAddress,
        blockNumber: 2,
        removed: false,
        event: {
          ...validEvent,
          creatorAddress: zeroAdress,
        },
      },
      {
        txHash: 'fakeTxhash3',
        address: curationContractAddress,
        blockNumber: 3,
        removed: false,
        event: {
          ...validEvent,
          uri: 'invalidSchema',
        },
      },
      {
        txHash: 'fakeTxhash4',
        address: curationContractAddress,
        blockNumber: 4,
        removed: false,
        event: {
          ...validEvent,
          uri: 'ipfs://notInMatters',
        },
      },
    ]
    await queue.syncCurationEvents(notMattersLogs)
    expect(await knex(txTable).count()).toEqual([{ count: '0' }])
    expect(await knex(blockchainTxTable).count()).toEqual([{ count: '4' }])
    expect(await knex(eventTable).count()).toEqual([{ count: '4' }])
  })
  test('matters logs will update tx', async () => {
    await knex(eventTable).del()
    await knex(blockchainTxTable).del()
    await knex(txTable).del()

    // no related tx, insert one
    const logs = [
      {
        txHash,
        address: curationContractAddress,
        blockNumber: 1,
        removed: false,
        event: {
          ...validEvent,
        },
      },
    ]
    await queue.syncCurationEvents(logs)
    expect(await knex(txTable).count()).toEqual([{ count: '1' }])
    const tx = await knex(txTable).first()
    const blockchainTx = await knex(blockchainTxTable).first()
    expect(tx.state).toBe(TRANSACTION_STATE.succeeded)
    expect(blockchainTx.transactionId).toBe(tx.id)

    // related tx state is not succeeded, update to succeeded
    await knex(eventTable).del()
    await knex(blockchainTxTable).update({
      state: BLOCKCHAIN_TRANSACTION_STATE.pending,
    })
    await knex(txTable).update({ state: TRANSACTION_STATE.pending })

    await queue.syncCurationEvents(logs)
    expect(await knex(txTable).count()).toEqual([{ count: '1' }])
    const updatedTx = await knex(txTable).where('id', tx.id).first()
    const updatedBlockchainTx = await knex(blockchainTxTable)
      .where('id', blockchainTx.id)
      .first()

    expect(updatedTx.state).toBe(TRANSACTION_STATE.succeeded)
    expect(updatedBlockchainTx.state).toBe(
      BLOCKCHAIN_TRANSACTION_STATE.succeeded
    )

    // related tx is invalid, cancel it and add new one
    await knex(eventTable).del()
    await knex(txTable).update({ recipientId: '3' })
    await knex(txTable).update({ state: TRANSACTION_STATE.pending })
    await knex(blockchainTxTable).update({
      state: BLOCKCHAIN_TRANSACTION_STATE.pending,
    })

    await queue.syncCurationEvents(logs)
    expect(await knex(txTable).count()).toEqual([{ count: '2' }])
    const originTx = await knex(txTable).where('id', tx.id).first()
    const originBlockchainTx = await knex(blockchainTxTable)
      .where('id', blockchainTx.id)
      .first()
    const newTx = await knex(txTable).whereNot('id', tx.id).first()

    expect(originTx.state).toBe(TRANSACTION_STATE.canceled)
    expect(originBlockchainTx.state).toBe(
      BLOCKCHAIN_TRANSACTION_STATE.succeeded
    )
    expect(newTx.state).toBe(TRANSACTION_STATE.succeeded)
    expect(originTx.providerTxId).not.toBe(null)
    expect(newTx.providerTxId).toBe(tx.providerTxId)
    expect(originBlockchainTx.transactionId).toBe(newTx.id)
  })
})
