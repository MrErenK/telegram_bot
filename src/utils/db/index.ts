import "reflect-metadata";
import { DataSource } from "typeorm";
import { DB_PATH, DB_TYPE } from "../config/manager";
import {
  User,
  GroupUser,
  GroupGrowth,
  GroupFight,
  GroupDuello,
} from "../../entity";
import logger from "../logger";

// Create TypeORM DataSource - add User entity back
export const AppDataSource = new DataSource({
  type: DB_TYPE as "sqlite",
  database: DB_PATH,
  entities: [User, GroupUser, GroupGrowth, GroupFight, GroupDuello],
  synchronize: true,
  logging: process.env.NODE_ENV === "development",
});

// Initialize database connection
export const initializeDatabase = async (): Promise<DataSource> => {
  try {
    const dataSource = await AppDataSource.initialize();
    logger.info("Database connection established");
    return dataSource;
  } catch (error) {
    logger.error("Error during Data Source initialization", error as Error);
    throw error;
  }
};

// Get the database instance
export const getDatabase = () => AppDataSource;

// Get repositories - add User repository
export const getUserRepository = () => AppDataSource.getRepository(User);
export const getGroupUserRepository = () =>
  AppDataSource.getRepository(GroupUser);
export const getGroupGrowthRepository = () =>
  AppDataSource.getRepository(GroupGrowth);
export const getGroupFightRepository = () =>
  AppDataSource.getRepository(GroupFight);
export const getGroupDuelloRepository = () =>
  AppDataSource.getRepository(GroupDuello);
