const { baseDown } = require('../utils')

const table = 'transaction'

exports.up = async (knex) => {
  // rename old transaction table
  await knex.schema.renameTable(table, 'transaction_obsolete')

  // new transaction table
  await knex.schema.createTable(table, (t) => {
    t.bigIncrements('id').primary()
    t.uuid('uuid').notNullable().unique()
    t.integer('amount').notNullable()
    t.enu('state', ['pending', 'succeeded', 'failed', 'canceled'])
      .notNullable()
      .defaultTo('pending')
    t.enu('currency', ['hkd', 'like']).notNullable()
    t.enu('purpose', ['donation', 'add-credit', 'refund', 'fee']).notNullable()

    t.enu('provider', ['stripe']).notNullable().defaultTo('stripe')
    t.string('provider_tx_id').notNullable().unique()
    t.bigInteger('refunded_id').unsigned()

    t.timestamp('created_at').defaultTo(knex.fn.now())
    t.timestamp('updated_at').defaultTo(knex.fn.now())

    t.bigInteger('sender_id').unsigned()
    t.bigInteger('recipient_id').unsigned()
    t.bigInteger('target_id').unsigned()

    // Setup foreign key
    t.foreign('sender_id').references('id').inTable('user')
    t.foreign('recipient_id').references('id').inTable('user')
    t.foreign('refunded_id').references('id').inTable(table)
  })
}

exports.down = baseDown(table)
