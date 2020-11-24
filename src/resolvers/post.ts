import { isAuth } from '../middleware/isAuthenticated';
import { MyContext } from 'src/types';
import {
  Arg,
  Ctx,
  Field,
  FieldResolver,
  InputType,
  Int,
  Mutation,
  ObjectType,
  Query,
  Resolver,
  Root,
  UseMiddleware
} from 'type-graphql';
import { Post } from '../entities/Post';
import { getConnection } from 'typeorm';

@InputType()
class PostInput {
  @Field()
  title: string;
  @Field()
  text: string;
}

@ObjectType()
class ErrorField {
  @Field()
  field: string;
  @Field()
  message: string;
}

@ObjectType()
class PostResponse {
  @Field(() => ErrorField, { nullable: true })
  error?: ErrorField;
  @Field(() => Post, { nullable: true })
  post?: Post;
}

@ObjectType()
class PaginatedPosts {
  @Field(() => [Post])
  posts: Post[];
  @Field()
  hasMore: boolean;
}

@Resolver(Post)
export class PostResolver {
  // Votes
  @Mutation(() => Boolean)
  @UseMiddleware(isAuth) // check if logged in
  async vote(
    @Arg('postId', () => Int) postId: number,
    @Arg('value', () => Int) value: number,
    @Ctx() { req }: MyContext
  ) {
    const isUpdoot = value !== -1;
    const realValue = isUpdoot ? 1 : -1;
    const { userId } = req.session;
    await getConnection().query(
      `
    START TRANSACTION;
    insert into updoot ("userId", "postId", value)
    values (${userId}, ${postId}, ${realValue});
    update post
    set points = points + ${realValue}
    where id = ${postId};
    COMMIT;
    `
    );
    return true;
  }

  // add new field to return 100 letter
  @FieldResolver(() => String)
  textSnippet(@Root() root: Post) {
    return root.text.slice(0, 200) + '...';
  }

  @Query(() => PaginatedPosts)
  async getAllPosts(
    @Arg('limit', () => Int) limit: number,
    @Arg('cursor', () => String, { nullable: true }) cursor: string | null
  ): Promise<PaginatedPosts> {
    const minLimit = Math.min(50, limit);
    const minLimitPlusOne = minLimit + 1;
    //=> get all posts and search for the auther by authorId but without ortherby it gives us error
    // const QB = getConnection()
    //   .getRepository(Post)
    //   .createQueryBuilder('post')
    //   .innerJoinAndSelect('post.author', 'author', 'author.id = post."authorId"')
    //=> delete this line   .orderBy('"createdAt"', 'DESC') // using '""' for psql to keep A
    //   .take(minLimitPlusOne);

    // if (cursor) {
    //   QB.where('post."createdAt" < :cursor', { cursor: new Date(parseInt(cursor)) });
    // }
    // check if he has more by adding +1 to minLimit
    // const posts = await QB.getMany();
    // return { posts: posts.slice(0, minLimit), hasMore: posts.length === minLimitPlusOne };

    //=> use the other way with query (p is alias small name for posts)
    const queryParams: any[] = [minLimitPlusOne];
    if (cursor) {
      queryParams[1] = new Date(parseInt(cursor));
    }
    const posts = await getConnection().query(
      `
      select p.*, 
      json_build_object(
        'id', u.id,
        'username', u.username,
        'email', u.email,
        'createdAt', u."createdAt",
        'updatedAt', u."updatedAt"
      ) author 
      from post p
      inner join public.user u on u.id = p."authorId"
      ${cursor ? `where p."createdAt" < $2` : ''}
      order by p."createdAt" DESC
      limit $1
    `,
      queryParams
    );

    return { posts, hasMore: posts.length === minLimitPlusOne };
  }

  @Query(() => Post, { nullable: true })
  async getPost(@Arg('id') id: number): Promise<Post | undefined> {
    return await Post.findOne(id);
  }

  @Mutation(() => PostResponse)
  @UseMiddleware(isAuth)
  async createPost(
    @Arg('postInput') postInput: PostInput,
    @Ctx() { req }: MyContext
  ): Promise<PostResponse> {
    // 2 sql queries 1 create 2 select
    const userId = req.session.userId;
    if (!postInput.title || postInput.title.length <= 3) {
      return { error: { field: 'title', message: 'Title should be greater than 3!' } };
    }
    if (!postInput.text || postInput.text.length <= 3) {
      return { error: { field: 'text', message: 'Body text should be greater than 3!' } };
    }
    const post = await Post.create({ ...postInput, authorId: userId }).save();
    return { post };
  }

  @Mutation(() => Post, { nullable: true })
  async updatePost(
    @Arg('id') id: number,
    @Arg('title', () => String, { nullable: true }) title: string
  ): Promise<Post | null> {
    const post = await Post.findOne(id);
    if (!post) {
      return null;
    }
    if (typeof title !== 'undefined') {
      await Post.update({ id }, { title });
    }
    return post;
  }

  //    Delete and return the deleted post
  @Mutation(() => Post, { nullable: true })
  async deletePostAndGetPost(@Arg('id') id: number): Promise<Post | undefined> {
    const post = await Post.findOne(id);
    await Post.delete(id);
    return post;
  }

  //    Delete and return true if not return false
  @Mutation(() => Boolean)
  async deletePost(@Arg('id') id: number): Promise<boolean> {
    await Post.delete(id);
    return true;
  }
}
