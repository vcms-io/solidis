<p align="center" width="100%">
  <img src="https://resources.vcms.io/assets/solidis.png" alt="Solidis" width="300"/>
</p>

<h1 align="center">@vcms-io/solidis</h1>

<p align="center">
  <b>High-performance, SOLID-structured RESP client for Redis and other RESP-compatible servers</b>
</p>

<p align="center">
  <a href="#-overview">Overview</a> •
  <a href="#-benchmarks">Benchmarks</a> •
  <a href="#-key-features">Features</a> •
  <a href="#-installation">Installation</a> •
  <a href="#-usage">Usage</a> •
  <a href="#%EF%B8%8F-configuration">Configuration</a> •
  <a href="#-advanced-features">Advanced</a><br/>
  <a href="#-extensions">Extensions</a> •
  <a href="#%EF%B8%8F-error-handling">Errors</a> •
  <a href="#-contributing">Contributing</a> •
  <a href="#-license">License</a>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@vcms-io/solidis"><img src="https://img.shields.io/npm/v/@vcms-io/solidis.svg" alt="npm version"></a>
  <a href="https://github.com/vcms-io/solidis"><img src="https://img.shields.io/badge/TypeScript-✓-blue" alt="TypeScript"></a>
  <a href="https://github.com/vcms-io/solidis"><img src="https://img.shields.io/badge/ESM/CJS-✓-yellow" alt="ESM/CJS"></a>
  <a href="https://github.com/vcms-io/solidis"><img src="https://img.shields.io/badge/RESP2/RESP3-✓-orange" alt="RESP2/RESP3"></a>
  <a href="https://github.com/vcms-io/solidis"><img src="https://img.shields.io/badge/Zero_Dependencies-✓-green" alt="Zero Dependencies"></a>
  <a href="https://github.com/vcms-io/solidis"><img src="https://img.shields.io/badge/Min_Bundle_Size-<30KB-brightgreen" alt="Bundle Size"></a>
</p>

> **English** | [한국어](./README.ko.md)

## 🔍 Overview

<p align="center" width="100%">
  <img src="https://resources.vcms.io/assets/bundle-graph.png" alt="Bundle size comparison" width="600"/>
</p>

Solidis is a modern RESP client built with SOLID principles, zero dependencies, and enterprise-grade performance in mind. It supports both RESP2 and RESP3 protocols and is optimized for modern JavaScript/TypeScript applications.

The library is designed for minimal bundle size with maximum type safety and performance:

- **Pure ESM/CJS** - Support for both module systems
- **Tree-shakable** - Import only what you need
- **Type-safe** - Extensive TypeScript definitions for all commands
- **Dependency-free** - Absolutely zero runtime dependencies

<div id="benchmark">

## 📊 Benchmarks

<div align="center">

# ⚡ Solidis vs ioredis ⚡

<small>Generated on 2026-06-17 15:08:14 · linux x64 · Node.js v22.22.3</small>
### Up to **113% faster** than ioredis! 🚀

---
<br/>

**15** / **15** benchmarks won · **75%** average speed improvement · **113%** peak speed improvement

*100,000 iterations × 10,000 concurrency · 1 KB payload · 10 repeats*

| | Benchmark | Commands | solidis | ioredis | Difference | Performance |
|---:|:---|:---:|:---:|:---:|:---:|:---|
| 🥇 | **Set Mutation** | SADD + SISMEMBER + SREM | **1634ms** | 3483ms | **+113%** 🔥🔥 | `██████████` |
| 🥈 | **List Range** | LPUSH + RPUSH + LRANGE | **1796ms** | 3688ms | **+105%** 🔥🔥 | `█████████░` |
| 🥉 | **List Mutation** | LPUSH + RPUSH + LPOP + RPOP + LLEN | **2601ms** | 4961ms | **+91%** 🔥🔥 | `████████░░` |
| 4. | **Hash Mutation** | HMSET + HMGET + HDEL | **1826ms** | 3447ms | **+89%** 🔥🔥 | `████████░░` |
| 5. | **Multi-Key** | MSET + MGET | **1719ms** | 3243ms | **+89%** 🔥🔥 | `████████░░` |
| 6. | **Sorted Set** | ZADD + ZRANGE + ZREM | **1813ms** | 3247ms | **+79%** 🔥🔥 | `███████░░░` |
| 7. | **Stream** | XADD + XRANGE + XLEN | **1849ms** | 3297ms | **+78%** 🔥🔥 | `███████░░░` |
| 8. | **Set** | SET | **776ms** | 1373ms | **+77%** 🔥🔥 | `███████░░░` |
| 9. | **Expire** | SET + EXPIRE + TTL | **1459ms** | 2539ms | **+74%** 🔥🔥 | `███████░░░` |
| 10. | **Set Read** | SADD + SISMEMBER + SMEMBERS | **1480ms** | 2573ms | **+74%** 🔥🔥 | `███████░░░` |
| 11. | **Pipeline Mixed** | SET + INCR + GET | **1566ms** | 2503ms | **+60%** 🔥 | `█████░░░░░` |
| 12. | **Non-Transaction** | SETPX + GET | **1346ms** | 2065ms | **+53%** 🔥 | `█████░░░░░` |
| 13. | **Hash Round-Trip** | HSET + HGET + HGETALL | **1837ms** | 2795ms | **+52%** 🔥 | `█████░░░░░` |
| 14. | **Counter** | INCR + DECR | **904ms** | 1373ms | **+52%** 🔥 | `█████░░░░░` |
| 15. | **Get Buffer** | GETBUFFER | **616ms** | 895ms | **+45%** 🔥 | `████░░░░░░` |

### Non Strictly Comparable Benchmarks

<sub>These benchmarks have library-specific behavior that prevents a strictly fair comparison.</sub>

| | Benchmark | Commands | solidis | ioredis | Difference | Performance |
|---:|:---|:---:|:---:|:---:|:---:|:---|
| 16. | **Transaction** | SET + EXPIRE + GET | 1307ms | 6187ms | **+373%** 🔥🔥 | `██████████` |
| 17. | **Transaction Mixed** | SET + GET | 1690ms | 7368ms | **+336%** 🔥🔥 | `██████████` |
| 18. | **Pub/Sub** | PUBLISH + MESSAGE | 797ms | 2698ms | **+238%** 🔥🔥 | `██████████` |
| 19. | **Info / Config** | INFO + CONFIGGET | 1062ms | 1983ms | **+87%** 🔥🔥 | `████████░░` |

<sub>Ranked by performance gain of `solidis` over `ioredis` (baseline). Elapsed = median time across repeats.</sub>

</div>

<br/>

## 📊 Detailed Metrics

<sub>All metrics per library: operations/s, commands/s, median elapsed time, and spread (coefficient of variation).</sub>

<details>
<summary>Click to expand detailed metrics table</summary>

| Benchmark | Library | ops/s | cmds/s | Elapsed | Spread |
|:---|:---|---:|---:|---:|---:|
| **Set Mutation: SADD + SISMEMBER + SREM**<br/><sub>1 KB</sub> | **solidis** | 61.2K | 183.5K | 1634ms | ±6.5% |
|  | ioredis | 28.7K | 86.1K | 3483ms | ±2.0% |
| **List Range: LPUSH + RPUSH + LRANGE**<br/><sub>1 KB</sub> | **solidis** | 55.7K | 167.0K | 1796ms | ±5.1% |
|  | ioredis | 27.1K | 81.3K | 3688ms | ±1.4% |
| **List Mutation: LPUSH + RPUSH + LPOP + RPOP + LLEN**<br/><sub>1 KB</sub> | **solidis** | 38.4K | 192.2K | 2601ms | ±2.1% |
|  | ioredis | 20.2K | 100.8K | 4961ms | ±1.2% |
| **Hash Mutation: HMSET + HMGET + HDEL**<br/><sub>1 KB</sub> | **solidis** | 54.8K | 164.3K | 1826ms | ±13.3% |
|  | ioredis | 29.0K | 87.0K | 3447ms | ±1.6% |
| **Multi-Key: MSET + MGET**<br/><sub>1 KB</sub> | **solidis** | 58.2K | 116.3K | 1719ms | ±2.8% |
|  | ioredis | 30.8K | 61.7K | 3243ms | ±3.5% |
| **Sorted Set: ZADD + ZRANGE + ZREM**<br/><sub>1 KB</sub> | **solidis** | 55.2K | 165.5K | 1813ms | ±5.2% |
|  | ioredis | 30.8K | 92.4K | 3247ms | ±0.9% |
| **Stream: XADD + XRANGE + XLEN**<br/><sub>1 KB</sub> | **solidis** | 54.1K | 162.2K | 1849ms | ±10.4% |
|  | ioredis | 30.3K | 91.0K | 3297ms | ±2.9% |
| **Set: SET**<br/><sub>1 KB</sub> | **solidis** | 128.8K | 128.8K | 776ms | ±3.4% |
|  | ioredis | 72.8K | 72.8K | 1373ms | ±1.4% |
| **Expire: SET + EXPIRE + TTL**<br/><sub>1 KB</sub> | **solidis** | 68.5K | 205.6K | 1459ms | ±10.1% |
|  | ioredis | 39.4K | 118.2K | 2539ms | ±1.5% |
| **Set Read: SADD + SISMEMBER + SMEMBERS**<br/><sub>1 KB</sub> | **solidis** | 67.6K | 202.8K | 1480ms | ±3.1% |
|  | ioredis | 38.9K | 116.6K | 2573ms | ±2.8% |
| **Pipeline Mixed: SET + INCR + GET**<br/><sub>1 KB</sub> | **solidis** | 63.9K | 191.6K | 1566ms | ±3.6% |
|  | ioredis | 40.0K | 119.9K | 2503ms | ±0.7% |
| **Non-Transaction: SETPX + GET**<br/><sub>1 KB</sub> | **solidis** | 74.3K | 148.6K | 1346ms | ±6.0% |
|  | ioredis | 48.4K | 96.8K | 2065ms | ±2.2% |
| **Hash Round-Trip: HSET + HGET + HGETALL**<br/><sub>1 KB</sub> | **solidis** | 54.4K | 163.3K | 1837ms | ±6.3% |
|  | ioredis | 35.8K | 107.3K | 2795ms | ±1.7% |
| **Counter: INCR + DECR**<br/><sub>1 KB</sub> | **solidis** | 110.6K | 221.3K | 904ms | ±2.4% |
|  | ioredis | 72.8K | 145.7K | 1373ms | ±1.3% |
| **Get Buffer: GETBUFFER**<br/><sub>1 KB</sub> | **solidis** | 162.3K | 162.3K | 616ms | ±4.6% |
|  | ioredis | 111.7K | 111.7K | 895ms | ±2.0% |

</details>

---

## ⚙️ Configuration

<details>
<summary>Click to expand benchmark configuration</summary>

| Parameter | Value |
|:----------|:------|
| Mode | `autopipeline` |
| Payload Sizes | 1 KB |
| Iterations | 100,000 |
| Warmup | 1,000 |
| Clients | 1 |
| Concurrency / Client | 10000 |
| Total Concurrency | 10000 |
| Repeats | 10 |
| Cooldown | 2500ms |
| Platform | linux x64 |
| Node.js | v22.22.3 |
| Date | 2026-06-17 15:08:14 |

</details>

---

## 📖 Methodology

- Each benchmark is run in an **isolated worker thread** to prevent GC and JIT cross-contamination
- Libraries are **alternated** between repeats to reduce ordering bias
- The Redis server is **flushed and settled** between each benchmark case
- Payloads use a **deterministic pseudo-random pool** shared by both libraries
- Elapsed time is the **median** across all repeat samples
- Spread is the **coefficient of variation** (σ / median × 100%)

</div>

## ✨ Key Features

- **Lightweight**
  - Zero dependencies
  - Minimum bundle size < 30KB
  - Full bundle size (with all commands) < 105KB

- **High Performance**
  - Efficient pipeline & batch processing
  - Minimal memory footprint (custom optimized parser)
  - Zero-copy buffer operations
  - Intelligent buffer management

- **Protocol Support**
  - RESP2 & RESP3 protocols support
  - Automatic protocol negotiation
  - Binary-safe operations
  - Full multi-byte character support

- **Advanced Features**
  - Transaction support (MULTI/EXEC)
  - Pipeline operations
  - Pub/Sub functionality
  - Automatic reconnection
  - Command timeout handling

- **Type Safety**
  - Robust TypeScript support
  - Comprehensive type definitions
  - Command-specific type guards
  - Runtime reply type checking

- **Extensibility**
  - Easy to extend client with internal & external commands
  - Customizable transaction handling
  - Plugin architecture support

## 📋 Requirements

- **Runtime**: Node.js 14 or higher
- **Development**: Node.js 22 LTS recommended for optimal stability

## 📥 Installation

```bash
# Using npm
npm install @vcms-io/solidis

# Using yarn
yarn add @vcms-io/solidis

# Using pnpm
pnpm add @vcms-io/solidis
```

## 💻 Usage

### 📦 Client Types

Solidis offers two client implementations:

#### 1. Basic Client (SolidisClient)

The basic client contains minimal functionality to reduce bundle size. You need to extend it with specific commands:

```typescript
import { SolidisClient } from '@vcms-io/solidis';
import { get } from '@vcms-io/solidis/command/get';
import { set } from '@vcms-io/solidis/command/set';
import { multi } from '@vcms-io/solidis/command/multi';

import type { SolidisClientExtensions } from '@vcms-io/solidis';

// Define extensions with type safety
const extensions = {
  get,
  set,
  multi
} satisfies SolidisClientExtensions;

// Initialize client with extensions
const client = new SolidisClient({
  host: '127.0.0.1',
  port: 6379
}).extend(extensions);

// Use commands
await client.set('key', 'value');

const value = await client.get('key');
```

#### 2. Featured Client (SolidisFeaturedClient)

A convenience client with all RESP commands pre-loaded:

```typescript
import { SolidisFeaturedClient } from '@vcms-io/solidis/featured';

// All RESP commands are pre-loaded
const client = new SolidisFeaturedClient({
  host: '127.0.0.1',
  port: 6379
});

// Use any RESP command directly
await client.set('key', 'value');
await client.hset('hash', 'field', 'value');
await client.lpush('list', 'item-1', 'item-2');
```

### 🔌 Connection Management

```typescript
// Create client (with lazy connect)
const client = new SolidisClient({
  uri: 'redis://127.0.0.1:6379',
  lazyConnect: true
}).extend({ get, set });

// Explicitly connect when needed
await client.connect();

// Handle connection events
client.on('connect', () => console.log('Connected to server'));
client.on('ready', () => console.log('Client is ready for commands'));
client.on('error', (err) => console.error('Error occurred:', err));
client.on('end', () => console.log('Connection closed'));

// Close connection when done
client.quit();
```

### ⚙️ Basic Operations

```typescript
// Set a key
await client.set('key', 'value');

// Get a key
const value = await client.get('key');

console.log(value); // 'value'

// Delete a key
await client.del('key');
```

### 💱 Transactions

```typescript
// Start a transaction
const transaction = client.multi();

// Queue commands (no await needed)
transaction.set('key', 'value');
transaction.incr('counter');
transaction.get('key');

// Execute transaction
const results = await transaction.exec();

console.log(results); // [[ 'OK' ], [ 1 ], [ <Buffer 76 61 6c 75 65> ]]

// Or discard a transaction if needed
const transaction = client.multi();

transaction.set('key', 'value');
transaction.discard(); // Cancel transaction
```

### ⏩ Pipelines

```typescript
// Create commands for a pipeline
const commands = [
  ['set', 'pipeline', 'value'],
  ['incr', 'counter'],
  ['get', 'pipeline']
];

// Send commands as a pipeline
const results = await client.send(commands);

console.log(results); // [[ 'OK' ], [ 1 ], [ <Buffer 76 61 6c 75 65> ]]
```

### 📡 Pub/Sub

```typescript
// Subscribe to channels
client.on('message', (channel, message) => {
  console.log(`Received ${message} from ${channel}`);
});

await client.subscribe('news');

// Publish from another client
await client.publish('news', 'Hello world!');
```

## ⚙️ Configuration

Solidis provides extensive configuration options:

```typescript
const client = new SolidisClient({
  // Connection
  uri: 'redis://localhost:6379',
  host: '127.0.0.1',
  port: 6379,
  useTLS: false,
  lazyConnect: false,

  // Authentication
  authentication: {
    username: 'user',
    password: 'password'
  },
  database: 0,

  // Protocol & Recovery
  clientName: 'solidis',
  protocol: 'RESP2',                    // 'RESP2' or 'RESP3'
  autoReconnect: true,
  enableReadyCheck: true,
  maxConnectionRetries: 20,
  connectionRetryDelay: 100,
  autoRecovery: {
    database: true,                     // Auto-select DB after reconnect
    subscribe: true,                    // Auto-resubscribe to channels
    ssubscribe: true,                   // Auto-resubscribe to shard channels
    psubscribe: true,                   // Auto-resubscribe to patterns
  },

  // Timeouts (milliseconds)
  commandTimeout: 5000,
  connectionTimeout: 2000,
  socketWriteTimeout: 1000,
  readyCheckInterval: 100,

  // Performance Tuning
  maxCommandsPerPipeline: 300,
  maxProcessRepliesPerChunk: 4 * 1024,  // 4KB
  maxSocketWriteSizePerOnce: 64 * 1024, // 64KB
  rejectOnPartialPipelineError: false,

  // Parser Configuration
  parser: {
    buffer: {
      initial: 4 * 1024 * 1024,         // 4MB
      shiftThreshold: 2 * 1024 * 1024,  // 2MB
    },
  },

  // Event Listeners
  maxEventListenersForClient: 10 * 1024,
  maxEventListenersForSocket: 10 * 1024,

  // Debug Options
  debug: false,
  debugMaxEntries: 10 * 1024,
});
```

## 🚀 Advanced Features

### 🛠️ Custom Commands

```typescript
import { SolidisClient } from '@vcms-io/solidis';
import { get, set } from '@vcms-io/solidis/command';

import type { SolidisClientExtensions } from '@vcms-io/solidis';

// Define extensions with custom commands
const extensions = {
  get,
  set,
  // Custom command implementation
  fill: async function(this: typeof client, keys: string[], value: string) {
    return await Promise.all(keys.map((key) => this.set(key, value)));
  },
} satisfies SolidisClientExtensions;

const client = new SolidisClient({
  host: '127.0.0.1',
  port: 6379
}).extend(extensions);

// Use custom command
await client.fill(['key1', 'key2', 'key3'], 'value');
```

### ⚡ Raw Commands

When you need to use a command that's not yet implemented:

```typescript
// Using raw commands with send()
const result = await client.send([['command', 'some', 'options']]);
```

### 🐛 Debugging

Enable detailed debug logging:

```typescript
// Enable debug mode
const client = new SolidisClient({
  debug: true
});

// Listen for debug events
client.on('debug', (entry) => {
  console.log(`[${entry.type}] ${entry.message}`, entry.data);
});

// Alternative: environment variable
// DEBUG=solidis node app.js
```

## 🧩 Extensions

The `@vcms-io/solidis-extensions` package provides additional functionality and utilities for Solidis clients. It includes pre-built extensions to enhance your Redis operations.

### 📥 Installation

```bash
# Using npm
npm install @vcms-io/solidis-extensions

# Using yarn
yarn add @vcms-io/solidis-extensions

# Using pnpm
pnpm add @vcms-io/solidis-extensions
```

### 📚 Available Extensions

- [**SpinLock**](https://github.com/vcms-io/solidis-extensions/blob/main/sources/domains/spinlock/README.md) - A lightweight mutex implemented as a Solidis command extension
- [**RedLock**](https://github.com/vcms-io/solidis-extensions/blob/main/sources/domains/redlock/README.md) - Fault-tolerant distributed mutex based on the Redlock algorithm

Check the [extensions documentation](https://github.com/vcms-io/solidis-extensions) for detailed usage examples.

## ⚠️ Error Handling

Solidis provides detailed error classes for different failure modes:

```typescript
import {
  SolidisClientError,
  SolidisConnectionError,
  SolidisParserError,
  SolidisPubSubError,
  SolidisRequesterError,
  unwrapSolidisError,
} from '@vcms-io/solidis';

try {
  await client.set('key', 'value');
} catch (error) {
  // Get the root cause with stack trace
  console.error(unwrapSolidisError(error));

  // Handle specific error types
  if (error instanceof SolidisConnectionError) {
    console.error('Connection error:', error.message);
  } else if (error instanceof SolidisParserError) {
    console.error('Parser error:', error.message);
  } else if (error instanceof SolidisClientError) {
    console.error('Client error:', error.message);
  }
}
```

## 🏗️ Structure

```
┌─────────────────────────────────────────────────┐
│                  SolidisClient                  │
│                                                 │
│      Creates & coordinates all components       │
│                                                 │
│     ┌────────────────────────────────────┐      │
│     │             Debug Memory           │      │
│     └───────┬───────────────────┬────────┘      │
│             ▼                   ▼               │
│     ┌────────────────┐  ┌────────────────┐      │
│     │   Connection   │─►│   Requester    │─┐    │
│     └────────────────┘  └────────────────┘ │    │
│                         ┌────────────────┐ │    │
│                         │     Parser     │◄┤    │
│                         └────────────────┘ │    │
│                         ┌────────────────┐ │    │
│                         │     PubSub     │◄┘    │
│                         └────────────────┘      │
│                                                 │
└─────────────────────────────────────────────────┘
         ┌──────────────┴─────────────┐
         ▼                            ▼
┌─────────────────┐       ┌───────────────────────┐
│ SolidisClient   │       │ SolidisFeaturedClient │
│ (needs extend)  │       │ (all commands)        │
└─────────────────┘       └───────────────────────┘
```

The Solidis structure follows a clear component separation:

- **SolidisClient**: Core entry point that creates and coordinates all components
- **Debug Memory**: Created in the client and injected into other components
- **Connection**: Manages TCP/TLS socket connections, reconnection and recovery
- **Requester**: Handles command pipelining & request states
- **Parser**: Processes RESP2/RESP3 protocol with optimized buffer handling
- **PubSub**: Maintains subscription state and is used by Requester for pub/sub events

## 🔔 Event System

Solidis emits the following events:

```typescript
// Connection events
client.on('connect', () => console.log('Connected to server'));
client.on('ready', () => console.log('Client is ready'));
client.on('end', () => console.log('Connection closed'));
client.on('error', (err) => console.error('Error:', err));

// Pub/Sub events
client.on('message', (channel, message) => console.log(`${channel}: ${message}`));
client.on('pmessage', (pattern, channel, message) => console.log(`${pattern} ${channel}: ${message}`));
client.on('subscribe', (channel, count) => console.log(`Subscribed to ${channel}`));
client.on('unsubscribe', (channel, count) => console.log(`Unsubscribed from ${channel}`));

// Debug events
client.on('debug', (entry) => console.log(`[${entry.type}] ${entry.message}`));
```

## 🤝 Contributing

Solidis is an open-source project and we welcome contributions from the community. Here's how you can contribute:

### 💻 Development Setup

```bash
# Clone the repository
git clone https://github.com/vcms-io/solidis.git
cd solidis

# Install dependencies
npm install

# Build the project
npm run build

# Run tests
npm test
```

### 📜 Contribution Guidelines

1. **Fork the Repository**: Start by forking the repository and then clone your fork.

2. **Create a Branch**: Create a branch for your feature or bugfix:
   ```bash
   git checkout -b feature/your-feature-name
   ```

3. **Follow Code Style**:
   - Use TypeScript strict mode
   - Follow existing patterns and naming conventions

4. **Submit Pull Request**: Push your changes to your fork and submit a pull request.
   - Provide a clear description of the changes
   - Reference any related issues
   - Add appropriate documentation

### ✅ Code Quality Guidelines

- **TypeScript**: Use strict typing and avoid `any` types and `as` cast where possible
- **Dependencies**: Avoid adding new dependencies unless absolutely necessary
- **Performance**: Consider performance implications of your changes
- **Bundle Size**: Keep the bundle size minimal

### 🚀 Release Process

Solidis follows semantic versioning (SemVer):
- **Patch (0.0.x)**: Bug fixes and minor changes that don't affect the API
- **Minor (0.x.0)**: New features added in a backward compatible manner
- **Major (x.0.0)**: Breaking changes to the public API

## 📄 License

Licensed under the MIT. See [LICENSE](/LICENSE) for more information.
