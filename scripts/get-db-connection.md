# Getting Your Database Connection String

Your Supabase database connection string wasn't auto-detected. Here's how to get it:

## Steps:

1. Go to your Supabase Dashboard:
   https://supabase.com/dashboard/project/nidijdprgoauwkmuioer

2. Navigate to: **Settings** → **Database**

3. Scroll down to **Connection string**

4. Select **Session mode** (recommended for migrations)

5. Copy the connection string - it will look like:
   ```
   postgresql://postgres.[PROJECT]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres
   ```

6. Add it to your `.env.local` file as:
   ```env
   DATABASE_URL=<paste the full connection string here>
   ```

## Alternative: Use Connection Pooling

If you see "Connection pooling" section, use that URI mode connection string instead.

## Then run:

```bash
npm run migrate
```

The migration script will automatically use the `DATABASE_URL` if it's set.
