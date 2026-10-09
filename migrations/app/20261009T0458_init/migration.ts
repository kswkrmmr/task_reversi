#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/91d757882d0c03f5f22d89b4569a0673f2de9a974613c27105992cd1716a0915/contract';
import endContract from '../../snapshots/91d757882d0c03f5f22d89b4569a0673f2de9a974613c27105992cd1716a0915/contract.json' with { type: 'json' };
import {
  Migration,
  MigrationCLI,
  checkExpression,
  col,
  fn,
  lit,
  primaryKey,
} from '@prisma/orm-postgres/migration';

export default class M extends Migration<never, End> {
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createSchema({ schema: 'public' }),
      this.createTable({
        schema: 'public',
        table: 'Game',
        columns: [
          col('finishedAt', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-string@1' } }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('startedAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('status', 'text', {
            notNull: true,
            default: lit('in_progress'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('undoUsed', 'bool', {
            notNull: true,
            default: lit(false),
            codecRef: { codecId: 'pg/bool@1' },
          }),
          col('userId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression('Game_status_check_ad2a986f', `"status" IN ('in_progress', 'finished')`),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'StonePlacement',
        columns: [
          col('col', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('color', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('gameId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('row', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('sequenceNumber', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('taskAttemptId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression('StonePlacement_color_check_f11ed0df', `"color" IN ('white', 'black')`),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'Task',
        columns: [
          col('active', 'bool', {
            notNull: true,
            default: lit(true),
            codecRef: { codecId: 'pg/bool@1' },
          }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('recurrenceType', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('title', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('userId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'Task_recurrenceType_check_8ffdcf6f',
            `"recurrenceType" IN ('once', 'daily')`,
          ),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'TaskAttempt',
        columns: [
          col('attemptedOn', 'date', { notNull: true, codecRef: { codecId: 'pg/date-string@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('gameId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('result', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('taskId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'TaskAttempt_result_check_700a35c9',
            `"result" IN ('achieved', 'missed')`,
          ),
        ],
      }),
      this.addUnique({
        schema: 'public',
        table: 'StonePlacement',
        constraint: 'StonePlacement_taskAttemptId_key',
        columns: ['taskAttemptId'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'StonePlacement',
        constraint: 'StonePlacement_gameId_row_col_key',
        columns: ['gameId', 'row', 'col'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'StonePlacement',
        constraint: 'StonePlacement_gameId_sequenceNumber_key',
        columns: ['gameId', 'sequenceNumber'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'TaskAttempt',
        constraint: 'TaskAttempt_taskId_attemptedOn_key',
        columns: ['taskId', 'attemptedOn'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Game',
        index: 'Game_userId_idx_a489d58a',
        columns: ['userId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Game',
        index: 'game_one_in_progress_19c3c9fe',
        columns: ['userId'],
        extras: { where: "(status = 'in_progress')", unique: true },
      }),
      this.createIndex({
        schema: 'public',
        table: 'StonePlacement',
        index: 'StonePlacement_gameId_idx_6cdb47f8',
        columns: ['gameId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Task',
        index: 'Task_userId_idx_a489d58a',
        columns: ['userId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'TaskAttempt',
        index: 'TaskAttempt_gameId_idx_6cdb47f8',
        columns: ['gameId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'TaskAttempt',
        index: 'TaskAttempt_taskId_idx_4965c936',
        columns: ['taskId'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'StonePlacement',
        foreignKey: {
          name: 'StonePlacement_gameId_fkey',
          columns: ['gameId'],
          references: { schema: 'public', table: 'Game', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'StonePlacement',
        foreignKey: {
          name: 'StonePlacement_taskAttemptId_fkey',
          columns: ['taskAttemptId'],
          references: { schema: 'public', table: 'TaskAttempt', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'TaskAttempt',
        foreignKey: {
          name: 'TaskAttempt_gameId_fkey',
          columns: ['gameId'],
          references: { schema: 'public', table: 'Game', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'TaskAttempt',
        foreignKey: {
          name: 'TaskAttempt_taskId_fkey',
          columns: ['taskId'],
          references: { schema: 'public', table: 'Task', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
