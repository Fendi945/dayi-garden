import { createStore } from './store.mjs';
import { createHandler } from './handler.mjs';
const env = {
  DASHSCOPE_API_KEY: Deno.env.get('DASHSCOPE_API_KEY'),
  DAYI_IMAGE_API_KEY: Deno.env.get('DAYI_IMAGE_API_KEY'),
};
const url = Deno.env.get('SUPABASE_URL')!;
const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_SECRET_KEY');
if (!url || !key) throw new Error('Missing Supabase server configuration');
Deno.serve(createHandler({store:createStore(url,key),env}));
