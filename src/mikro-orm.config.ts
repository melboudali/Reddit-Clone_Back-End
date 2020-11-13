import path from 'path';
import { __prod__ } from './config/constants';
import { Post } from './entities/Post';
import { MikroORM } from '@mikro-orm/core';
import { User } from './entities/User';

export default {
  migrations: {
    path: path.join(__dirname, './migrations'), // path to the folder with migrations
    pattern: /^[\w-]+\d+\.[tj]s$/ // regex pattern for the migration files
  },
  entities: [Post, User],
  dbName: 'reddit_clone',
  user: 'postgres',
  password: 'postgres',
  type: 'postgresql',
  debug: !__prod__
} as Parameters<typeof MikroORM.init>[0];