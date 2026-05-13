import { db } from "@loadclass/db";

export type RegistryTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
export type RegistryStore = typeof db | RegistryTransaction;
