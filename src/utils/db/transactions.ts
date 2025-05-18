import { EntityManager, QueryRunner } from 'typeorm';
import { AppDataSource } from './index';
import logger from '../logger';

/**
 * Transaction options interface
 */
export interface TransactionOptions {
  /**
   * Whether to log transaction details
   */
  logging?: boolean;
  
  /**
   * Custom transaction name for logging purposes
   */
  name?: string;
}

/**
 * Default transaction options
 */
const defaultOptions: TransactionOptions = {
  logging: true,
  name: 'Database Transaction'
};

/**
 * Execute a function within a database transaction
 * 
 * @param callback Function to execute within the transaction
 * @param options Transaction options
 * @returns Result of the callback function
 */
export async function withTransaction<T>(
  callback: (entityManager: EntityManager) => Promise<T>,
  options: TransactionOptions = {}
): Promise<T> {
  const opts = { ...defaultOptions, ...options };
  const { logging, name } = opts;
  
  const queryRunner = AppDataSource.createQueryRunner();
  let result: T;
  
  if (logging) {
    logger.debug(`Starting ${name}`);
  }
  
  try {
    // Connect and start transaction
    await queryRunner.connect();
    await queryRunner.startTransaction();
    
    // Execute the callback function with the transaction's entity manager
    result = await callback(queryRunner.manager);
    
    // Commit the transaction
    await queryRunner.commitTransaction();
    
    if (logging) {
      logger.debug(`Successfully committed ${name}`);
    }
    
    return result;
  } catch (error) {
    // Rollback transaction on error
    if (queryRunner.isTransactionActive) {
      await queryRunner.rollbackTransaction();
    }
    
    if (logging) {
      logger.error(`Failed to complete ${name}, transaction rolled back`, error as Error);
    }
    
    throw error;
  } finally {
    // Release the query runner
    await queryRunner.release();
  }
}

/**
 * Run a batch of operations as a single transaction
 * 
 * @param operations Array of operations to run in a transaction
 * @param options Transaction options
 * @returns Array of results from each operation
 */
export async function batchTransaction<T>(
  operations: ((entityManager: EntityManager) => Promise<T>)[],
  options: TransactionOptions = {}
): Promise<T[]> {
  return withTransaction(async (entityManager) => {
    const results: T[] = [];
    
    for (const operation of operations) {
      const result = await operation(entityManager);
      results.push(result);
    }
    
    return results;
  }, options);
}

/**
 * Execute a callback with isolated queryRunner
 * Useful for complex queries that don't need transactions
 * 
 * @param callback Function to execute with the query runner
 * @returns Result of the callback function
 */
export async function withQueryRunner<T>(
  callback: (queryRunner: QueryRunner) => Promise<T>
): Promise<T> {
  const queryRunner = AppDataSource.createQueryRunner();
  
  try {
    await queryRunner.connect();
    return await callback(queryRunner);
  } finally {
    await queryRunner.release();
  }
}