#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/715deb653d2d16ad6b3f308ccb985dd40b2a3de7432f9fb0ef47e0ea292691cf/contract';
import endContract from '../../snapshots/715deb653d2d16ad6b3f308ccb985dd40b2a3de7432f9fb0ef47e0ea292691cf/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/91d757882d0c03f5f22d89b4569a0673f2de9a974613c27105992cd1716a0915/contract';
import startContract from '../../snapshots/91d757882d0c03f5f22d89b4569a0673f2de9a974613c27105992cd1716a0915/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.addColumn({
        schema: 'public',
        table: 'Task',
        column: col('dueAt', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-string@1' } }),
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
