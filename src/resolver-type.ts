import { FieldValues, ResolverOptions, ResolverResult } from 'react-hook-form';

// Resolver adapted from https://github.com/react-hook-form/resolvers/blob/master/zod/src/types.ts
// Hopefully generic enough to cover all resolvers (not just Zod)
export type GenericResolver = <T>(
  schema: T,
  schemaOptions?: unknown,
  factoryOptions?: {
    /**
     * @default async
     */
    mode?: 'async' | 'sync';
    /**
     * Return the raw input values rather than the parsed values.
     * @default false
     */
    raw?: boolean;
  }
) => <TFieldValues extends FieldValues, TContext>(
  values: TFieldValues,
  context: TContext | undefined,
  options: ResolverOptions<TFieldValues>
) => Promise<ResolverResult<TFieldValues>>;
