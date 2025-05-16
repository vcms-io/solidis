import {
  aclCat,
  aclDeluser,
  aclDryrun,
  aclGenpass,
  aclGetuser,
  aclHelp,
  aclList,
  aclLog,
  aclSave,
  aclSetuser,
  aclUsers,
  aclWhoami,
  append,
  bfAdd,
  bfCard,
  bfExists,
  bfInfo,
  bfInsert,
  bfLoadchunk,
  bfMadd,
  bfMexists,
  bfReserve,
  bfScandump,
  bgrewriteaof,
  bgsave,
  bitcount,
  bitfield,
  bitfieldRo,
  bitop,
  bitpos,
  blmove,
  blmpop,
  blpop,
  brpop,
  brpoplpush,
  bzmpop,
  bzpopmax,
  bzpopmin,
  cfAdd,
  cfAddnx,
  cfCount,
  cfDel,
  cfExists,
  cfInfo,
  cfInsert,
  cfInsertnx,
  cfLoadchunk,
  cfMexists,
  cfReserve,
  cfScandump,
  clientCaching,
  clientGetname,
  clientGetredir,
  clientHelp,
  clientId,
  clientInfo,
  clientKill,
  clientList,
  clientNoEvict,
  clientNoTouch,
  clientPause,
  clientReply,
  clientSetinfo,
  clientSetname,
  clientTracking,
  clientTrackinginfo,
  clientUnblock,
  clientUnpause,
  commandCount,
  commandDocs,
  commandGetkeys,
  commandGetkeysandflags,
  commandHelp,
  commandList,
  configGet,
  configHelp,
  configResetstat,
  configRewrite,
  configSet,
  copy,
  dbsize,
  debug,
  decr,
  decrby,
  del,
  dump,
  echo,
  evalRo,
  evalsha,
  evalshaRo,
  eval as evaluate,
  exists,
  expire,
  expireat,
  expiretime,
  failover,
  fcall,
  fcallRo,
  flushall,
  flushdb,
  functionDelete,
  functionDump,
  functionFlush,
  functionHelp,
  functionKill,
  functionList,
  functionLoad,
  functionRestore,
  functionStats,
  geoadd,
  geodist,
  geohash,
  geopos,
  georadius,
  georadiusRo,
  georadiusbymember,
  georadiusbymemberRo,
  geosearch,
  geosearchstore,
  get,
  getBuffer,
  getbit,
  getdel,
  getex,
  getrange,
  getset,
  hdel,
  hexists,
  hexpire,
  hexpireat,
  hexpiretime,
  hget,
  hgetall,
  hincrby,
  hincrbyfloat,
  hkeys,
  hlen,
  hmget,
  hmset,
  hpersist,
  hpexpire,
  hpexpireat,
  hpexpiretime,
  hpttl,
  hrandfield,
  hscan,
  hset,
  hsetnx,
  hstrlen,
  httl,
  hvals,
  incr,
  incrby,
  incrbyfloat,
  jsonArrappend,
  jsonArrindex,
  jsonArrinsert,
  jsonArrlen,
  jsonArrpop,
  jsonArrtrim,
  jsonClear,
  jsonDebug,
  jsonDel,
  jsonForget,
  jsonGet,
  jsonMerge,
  jsonMget,
  jsonMset,
  jsonNumincrby,
  jsonNummultby,
  jsonObjkeys,
  jsonObjlen,
  jsonResp,
  jsonSet,
  jsonStrappend,
  jsonStrlen,
  jsonToggle,
  jsonType,
  keys,
  lastsave,
  latencyDoctor,
  latencyGraph,
  latencyHelp,
  latencyHistogram,
  latencyHistory,
  latencyLatest,
  latencyReset,
  lcs,
  lindex,
  linsert,
  llen,
  lmove,
  lmpop,
  lolwut,
  lpop,
  lpos,
  lpush,
  lpushx,
  lrange,
  lrem,
  lset,
  ltrim,
  memoryDoctor,
  memoryHelp,
  memoryMallocStats,
  memoryPurge,
  memoryStats,
  memoryUsage,
  mget,
  migrate,
  moduleHelp,
  moduleList,
  moduleLoad,
  moduleLoadex,
  moduleUnload,
  move,
  mset,
  msetnx,
  multi,
  objectEncoding,
  objectFreq,
  objectHelp,
  objectIdletime,
  objectRefcount,
  persist,
  pexpire,
  pexpireat,
  pexpiretime,
  pfadd,
  pfcount,
  pfmerge,
  ping,
  pipeline,
  psetex,
  psubscribe,
  pttl,
  publish,
  pubsubChannels,
  pubsubHelp,
  pubsubNumpat,
  pubsubNumsub,
  pubsubShardchannels,
  pubsubShardnumsub,
  punsubscribe,
  randomkey,
  rename,
  renamenx,
  replconf,
  replicaof,
  reset,
  restore,
  role,
  rpop,
  rpoplpush,
  rpush,
  rpushx,
  sadd,
  save,
  scan,
  scard,
  scriptDebug,
  scriptExists,
  scriptFlush,
  scriptHelp,
  scriptKill,
  scriptLoad,
  sdiff,
  sdiffstore,
  set,
  setbit,
  setex,
  setnx,
  setrange,
  shutdown,
  sinter,
  sintercard,
  sinterstore,
  sismember,
  slowlogGet,
  slowlogHelp,
  slowlogLen,
  slowlogReset,
  smembers,
  smismember,
  smove,
  sort,
  sortRo,
  spop,
  spublish,
  srandmember,
  srem,
  sscan,
  ssubscribe,
  strlen,
  subscribe,
  sunion,
  sunionstore,
  sunsubscribe,
  swapdb,
  sync,
  time,
  touch,
  tsAdd,
  tsAlter,
  tsCreate,
  tsCreaterule,
  tsDecrby,
  tsDel,
  tsDeleterule,
  tsGet,
  tsIncrby,
  tsInfo,
  tsMadd,
  tsMget,
  tsMrange,
  tsMrevrange,
  tsQueryindex,
  tsRange,
  tsRevrange,
  ttl,
  type,
  unlink,
  unsubscribe,
  unwatch,
  wait,
  waitaof,
  watch,
  xack,
  xadd,
  xautoclaim,
  xclaim,
  xdel,
  xgroupCreate,
  xgroupCreateconsumer,
  xgroupDelconsumer,
  xgroupDestroy,
  xgroupHelp,
  xgroupSetid,
  xinfoConsumers,
  xinfoGroups,
  xinfoHelp,
  xinfoStream,
  xlen,
  xpending,
  xrange,
  xread,
  xreadgroup,
  xrevrange,
  xsetid,
  xtrim,
  zadd,
  zcard,
  zcount,
  zdiff,
  zdiffstore,
  zincrby,
  zinter,
  zintercard,
  zinterstore,
  zlexcount,
  zmpop,
  zmscore,
  zpopmax,
  zpopmin,
  zrandmember,
  zrange,
  zrangebylex,
  zrangebyscore,
  zrangestore,
  zrank,
  zrem,
  zremrangebylex,
  zremrangebyscore,
  zrevrange,
  zrevrangebylex,
  zrevrangebyscore,
  zrevrank,
  zscan,
  zscore,
  zunion,
  zunionstore,
} from '../command/index.ts';
import { SolidisClient } from '../index.ts';

import type { SolidisClientOptions } from '../index.ts';

export class SolidisFeaturedClient extends SolidisClient {
  constructor(options?: SolidisClientOptions) {
    super(options);

    for (const method of Object.getOwnPropertyNames(this)) {
      if (method !== 'constructor' && typeof this[method] === 'function') {
        this[method] = this[method].bind(this);
      }
    }
  }

  aclCat = aclCat;
  aclDeluser = aclDeluser;
  aclDryrun = aclDryrun;
  aclGenpass = aclGenpass;
  aclGetuser = aclGetuser;
  aclHelp = aclHelp;
  aclList = aclList;
  aclLog = aclLog;
  aclSave = aclSave;
  aclSetuser = aclSetuser;
  aclUsers = aclUsers;
  aclWhoami = aclWhoami;
  append = append;
  bfAdd = bfAdd;
  bfCard = bfCard;
  bfExists = bfExists;
  bfInfo = bfInfo;
  bfInsert = bfInsert;
  bfLoadchunk = bfLoadchunk;
  bfMadd = bfMadd;
  bfMexists = bfMexists;
  bfReserve = bfReserve;
  bfScandump = bfScandump;
  bgrewriteaof = bgrewriteaof;
  bgsave = bgsave;
  bitcount = bitcount;
  bitfieldRo = bitfieldRo;
  bitfield = bitfield;
  bitop = bitop;
  bitpos = bitpos;
  blmove = blmove;
  blmpop = blmpop;
  blpop = blpop;
  brpop = brpop;
  brpoplpush = brpoplpush;
  bzmpop = bzmpop;
  bzpopmax = bzpopmax;
  bzpopmin = bzpopmin;
  cfAdd = cfAdd;
  cfAddnx = cfAddnx;
  cfCount = cfCount;
  cfDel = cfDel;
  cfExists = cfExists;
  cfInfo = cfInfo;
  cfInsert = cfInsert;
  cfInsertnx = cfInsertnx;
  cfLoadchunk = cfLoadchunk;
  cfMexists = cfMexists;
  cfReserve = cfReserve;
  cfScandump = cfScandump;
  clientCaching = clientCaching;
  clientGetname = clientGetname;
  clientGetredir = clientGetredir;
  clientHelp = clientHelp;
  clientId = clientId;
  clientInfo = clientInfo;
  clientKill = clientKill;
  clientList = clientList;
  clientNoEvict = clientNoEvict;
  clientNoTouch = clientNoTouch;
  clientPause = clientPause;
  clientReply = clientReply;
  clientSetinfo = clientSetinfo;
  clientSetname = clientSetname;
  clientTracking = clientTracking;
  clientTrackinginfo = clientTrackinginfo;
  clientUnblock = clientUnblock;
  clientUnpause = clientUnpause;
  commandCount = commandCount;
  commandDocs = commandDocs;
  commandGetkeys = commandGetkeys;
  commandGetkeysandflags = commandGetkeysandflags;
  commandHelp = commandHelp;
  commandList = commandList;
  configGet = configGet;
  configHelp = configHelp;
  configResetstat = configResetstat;
  configRewrite = configRewrite;
  configSet = configSet;
  copy = copy;
  dbsize = dbsize;
  debug = debug;
  decr = decr;
  decrby = decrby;
  del = del;
  dump = dump;
  echo = echo;
  evalRo = evalRo;
  eval = evaluate;
  evalsha = evalsha;
  evalshaRo = evalshaRo;
  exists = exists;
  expire = expire;
  expireat = expireat;
  expiretime = expiretime;
  failover = failover;
  fcallRo = fcallRo;
  fcall = fcall;
  flushall = flushall;
  flushdb = flushdb;
  functionDelete = functionDelete;
  functionDump = functionDump;
  functionFlush = functionFlush;
  functionHelp = functionHelp;
  functionKill = functionKill;
  functionList = functionList;
  functionLoad = functionLoad;
  functionRestore = functionRestore;
  functionStats = functionStats;
  geoadd = geoadd;
  geodist = geodist;
  geohash = geohash;
  geopos = geopos;
  georadiusRo = georadiusRo;
  georadius = georadius;
  georadiusbymemberRo = georadiusbymemberRo;
  georadiusbymember = georadiusbymember;
  geosearch = geosearch;
  geosearchstore = geosearchstore;
  getBuffer = getBuffer;
  get = get;
  getbit = getbit;
  getdel = getdel;
  getex = getex;
  getrange = getrange;
  /**
   * @deprecated
   * @see https://redis.io/docs/latest/commands/getset/
   * As of Redis version 6.2.0, this command is regarded as deprecated.
   * Use `set` with the `returnOldValue` option instead.
   */
  getset = getset;
  hdel = hdel;
  hexists = hexists;
  hexpire = hexpire;
  hexpireat = hexpireat;
  hexpiretime = hexpiretime;
  hget = hget;
  hgetall = hgetall;
  hincrby = hincrby;
  hincrbyfloat = hincrbyfloat;
  hkeys = hkeys;
  hlen = hlen;
  hmget = hmget;
  /**
   * @deprecated
   * @see https://redis.io/docs/latest/commands/hmset/
   * As of Redis version 4.0.0, this command is regarded as deprecated.
   * Use `hset` instead.
   */
  hmset = hmset;
  hpersist = hpersist;
  hpexpire = hpexpire;
  hpexpireat = hpexpireat;
  hpexpiretime = hpexpiretime;
  hpttl = hpttl;
  hrandfield = hrandfield;
  hscan = hscan;
  hset = hset;
  hsetnx = hsetnx;
  hstrlen = hstrlen;
  httl = httl;
  hvals = hvals;
  incr = incr;
  incrby = incrby;
  incrbyfloat = incrbyfloat;
  jsonArrappend = jsonArrappend;
  jsonArrindex = jsonArrindex;
  jsonArrinsert = jsonArrinsert;
  jsonArrlen = jsonArrlen;
  jsonArrpop = jsonArrpop;
  jsonArrtrim = jsonArrtrim;
  jsonClear = jsonClear;
  jsonDebug = jsonDebug;
  jsonDel = jsonDel;
  jsonForget = jsonForget;
  jsonGet = jsonGet;
  jsonMerge = jsonMerge;
  jsonMget = jsonMget;
  jsonMset = jsonMset;
  jsonNumincrby = jsonNumincrby;
  jsonNummultby = jsonNummultby;
  jsonObjkeys = jsonObjkeys;
  jsonObjlen = jsonObjlen;
  jsonResp = jsonResp;
  jsonSet = jsonSet;
  jsonStrappend = jsonStrappend;
  jsonStrlen = jsonStrlen;
  jsonToggle = jsonToggle;
  jsonType = jsonType;
  keys = keys;
  lastsave = lastsave;
  latencyDoctor = latencyDoctor;
  latencyGraph = latencyGraph;
  latencyHelp = latencyHelp;
  latencyHistogram = latencyHistogram;
  latencyHistory = latencyHistory;
  latencyLatest = latencyLatest;
  latencyReset = latencyReset;
  lcs = lcs;
  lindex = lindex;
  linsert = linsert;
  llen = llen;
  lmove = lmove;
  lmpop = lmpop;
  lolwut = lolwut;
  lpop = lpop;
  lpos = lpos;
  lpush = lpush;
  lpushx = lpushx;
  lrange = lrange;
  lrem = lrem;
  lset = lset;
  ltrim = ltrim;
  memoryDoctor = memoryDoctor;
  memoryHelp = memoryHelp;
  memoryMallocStats = memoryMallocStats;
  memoryPurge = memoryPurge;
  memoryStats = memoryStats;
  memoryUsage = memoryUsage;
  mget = mget;
  migrate = migrate;
  moduleHelp = moduleHelp;
  moduleList = moduleList;
  moduleLoad = moduleLoad;
  moduleLoadex = moduleLoadex;
  moduleUnload = moduleUnload;
  move = move;
  mset = mset;
  msetnx = msetnx;
  multi = multi;
  objectEncoding = objectEncoding;
  objectFreq = objectFreq;
  objectHelp = objectHelp;
  objectIdletime = objectIdletime;
  objectRefcount = objectRefcount;
  persist = persist;
  pexpire = pexpire;
  pexpireat = pexpireat;
  pexpiretime = pexpiretime;
  pfadd = pfadd;
  pfcount = pfcount;
  pfmerge = pfmerge;
  ping = ping;
  pipeline = pipeline;
  psetex = psetex;
  psubscribe = psubscribe;
  pttl = pttl;
  publish = publish;
  pubsubChannels = pubsubChannels;
  pubsubHelp = pubsubHelp;
  pubsubNumpat = pubsubNumpat;
  pubsubNumsub = pubsubNumsub;
  pubsubShardchannels = pubsubShardchannels;
  pubsubShardnumsub = pubsubShardnumsub;
  punsubscribe = punsubscribe;
  randomkey = randomkey;
  rename = rename;
  renamenx = renamenx;
  replconf = replconf;
  replicaof = replicaof;
  reset = reset;
  restore = restore;
  role = role;
  rpop = rpop;
  rpoplpush = rpoplpush;
  rpush = rpush;
  rpushx = rpushx;
  sadd = sadd;
  save = save;
  scan = scan;
  scard = scard;
  scriptDebug = scriptDebug;
  scriptExists = scriptExists;
  scriptFlush = scriptFlush;
  scriptHelp = scriptHelp;
  scriptKill = scriptKill;
  scriptLoad = scriptLoad;
  sdiff = sdiff;
  sdiffstore = sdiffstore;
  set = set;
  setbit = setbit;
  setex = setex;
  setnx = setnx;
  setrange = setrange;
  shutdown = shutdown;
  sinter = sinter;
  sintercard = sintercard;
  sinterstore = sinterstore;
  sismember = sismember;
  slowlogGet = slowlogGet;
  slowlogHelp = slowlogHelp;
  slowlogLen = slowlogLen;
  slowlogReset = slowlogReset;
  smembers = smembers;
  smismember = smismember;
  smove = smove;
  sortRo = sortRo;
  sort = sort;
  spop = spop;
  spublish = spublish;
  srandmember = srandmember;
  srem = srem;
  sscan = sscan;
  ssubscribe = ssubscribe;
  strlen = strlen;
  subscribe = subscribe;
  sunion = sunion;
  sunionstore = sunionstore;
  sunsubscribe = sunsubscribe;
  swapdb = swapdb;
  sync = sync;
  time = time;
  touch = touch;
  tsAdd = tsAdd;
  tsAlter = tsAlter;
  tsCreate = tsCreate;
  tsCreaterule = tsCreaterule;
  tsDecrby = tsDecrby;
  tsDel = tsDel;
  tsDeleterule = tsDeleterule;
  tsGet = tsGet;
  tsIncrby = tsIncrby;
  tsInfo = tsInfo;
  tsMadd = tsMadd;
  tsMget = tsMget;
  tsMrange = tsMrange;
  tsMrevrange = tsMrevrange;
  tsQueryindex = tsQueryindex;
  tsRange = tsRange;
  tsRevrange = tsRevrange;
  ttl = ttl;
  type = type;
  unlink = unlink;
  unsubscribe = unsubscribe;
  unwatch = unwatch;
  wait = wait;
  waitaof = waitaof;
  watch = watch;
  xack = xack;
  xadd = xadd;
  xautoclaim = xautoclaim;
  xclaim = xclaim;
  xdel = xdel;
  xgroupCreate = xgroupCreate;
  xgroupCreateconsumer = xgroupCreateconsumer;
  xgroupDelconsumer = xgroupDelconsumer;
  xgroupDestroy = xgroupDestroy;
  xgroupHelp = xgroupHelp;
  xgroupSetid = xgroupSetid;
  xinfoConsumers = xinfoConsumers;
  xinfoGroups = xinfoGroups;
  xinfoHelp = xinfoHelp;
  xinfoStream = xinfoStream;
  xlen = xlen;
  xpending = xpending;
  xrange = xrange;
  xread = xread;
  xreadgroup = xreadgroup;
  xrevrange = xrevrange;
  xsetid = xsetid;
  xtrim = xtrim;
  zadd = zadd;
  zcard = zcard;
  zcount = zcount;
  zdiff = zdiff;
  zdiffstore = zdiffstore;
  zincrby = zincrby;
  zinter = zinter;
  zintercard = zintercard;
  zinterstore = zinterstore;
  zlexcount = zlexcount;
  zmpop = zmpop;
  zmscore = zmscore;
  zpopmax = zpopmax;
  zpopmin = zpopmin;
  zrandmember = zrandmember;
  zrange = zrange;
  zrangebylex = zrangebylex;
  zrangebyscore = zrangebyscore;
  zrangestore = zrangestore;
  zrank = zrank;
  zrem = zrem;
  zremrangebylex = zremrangebylex;
  zremrangebyscore = zremrangebyscore;
  zrevrange = zrevrange;
  zrevrangebylex = zrevrangebylex;
  zrevrangebyscore = zrevrangebyscore;
  zrevrank = zrevrank;
  zscan = zscan;
  zscore = zscore;
  zunion = zunion;
  zunionstore = zunionstore;
}
