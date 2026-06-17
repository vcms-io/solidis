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

<small>Generated on 2026-06-17 15:28:53 · linux x64 · Node.js v22.22.3</small>
### Up to **2.1x faster** than ioredis! 🚀

---
<br/>

**15** / **15** benchmarks won · **76%** average speed improvement · **113%** peak speed improvement

*100,000 iterations × 10,000 concurrency · 1 KB payload · 10 repeats*

| | Benchmark | Commands | solidis | ioredis | Difference | Performance |
|---:|:---|:---:|:---:|:---:|:---:|:---|
| 🥇 | **Set Mutation** | SADD + SISMEMBER + SREM | **1586ms** | 3371ms | **2.1x** 🔥🔥 | `██████████` |
| 🥈 | **List Range** | LPUSH + RPUSH + LRANGE | **1858ms** | 3687ms | **2.0x** 🔥🔥 | `█████████░` |
| 🥉 | **Hash Mutation** | HMSET + HMGET + HDEL | **1780ms** | 3397ms | **1.9x** 🔥🔥 | `████████░░` |
| 4. | **List Mutation** | LPUSH + RPUSH + LPOP + RPOP + LLEN | **2294ms** | 4375ms | **1.9x** 🔥🔥 | `████████░░` |
| 5. | **Multi-Key** | MSET + MGET | **1725ms** | 3186ms | **1.8x** 🔥🔥 | `████████░░` |
| 6. | **Set** | SET | **726ms** | 1304ms | **1.8x** 🔥🔥 | `███████░░░` |
| 7. | **Sorted Set** | ZADD + ZRANGE + ZREM | **1811ms** | 3228ms | **1.8x** 🔥🔥 | `███████░░░` |
| 8. | **Expire** | SET + EXPIRE + TTL | **1483ms** | 2642ms | **1.8x** 🔥🔥 | `███████░░░` |
| 9. | **Stream** | XADD + XRANGE + XLEN | **1771ms** | 3125ms | **1.8x** 🔥🔥 | `███████░░░` |
| 10. | **Set Read** | SADD + SISMEMBER + SMEMBERS | **1518ms** | 2646ms | **1.7x** 🔥🔥 | `███████░░░` |
| 11. | **Non-Transaction** | SETPX + GET | **1294ms** | 2184ms | **1.7x** 🔥🔥 | `██████░░░░` |
| 12. | **Pipeline Mixed** | SET + INCR + GET | **1775ms** | 2884ms | **1.6x** 🔥🔥 | `██████░░░░` |
| 13. | **Hash Round-Trip** | HSET + HGET + HGETALL | **1749ms** | 2720ms | **1.6x** 🔥 | `█████░░░░░` |
| 14. | **Counter** | INCR + DECR | **936ms** | 1432ms | **1.5x** 🔥 | `█████░░░░░` |
| 15. | **Get Buffer** | GETBUFFER | **641ms** | 894ms | **1.4x** 🔥 | `████░░░░░░` |

### Non Strictly Comparable Benchmarks

<sub>These benchmarks have library-specific behavior that prevents a strictly fair comparison.</sub>

| | Benchmark | Commands | solidis | ioredis | Difference | Performance |
|---:|:---|:---:|:---:|:---:|:---:|:---|
| 16. | **Transaction** | SET + EXPIRE + GET | 1276ms | 5043ms | **4.0x** 🔥🔥 | `██████████` |
| 17. | **Transaction Mixed** | SET + GET | 1660ms | 6084ms | **3.7x** 🔥🔥 | `██████████` |
| 18. | **Pub/Sub** | PUBLISH + MESSAGE | 757ms | 2538ms | **3.4x** 🔥🔥 | `██████████` |
| 19. | **Info / Config** | INFO + CONFIGGET | 1175ms | 2142ms | **1.8x** 🔥🔥 | `███████░░░` |

<sub>Ranked by performance gain of `solidis` over `ioredis` (baseline). Elapsed = median time across repeats.</sub>

</div>

<br/>

## 📊 Detailed Metrics

<sub>All metrics per library: operations/s, commands/s, median elapsed time, and spread (coefficient of variation).</sub>

<details>
<summary>Click to expand detailed metrics table</summary>

| Benchmark | Library | ops/s | cmds/s | Elapsed | Spread |
|:---|:---|---:|---:|---:|---:|
| **Set Mutation: SADD + SISMEMBER + SREM**<br/><sub>1 KB</sub> | **solidis** | 63.1K | 189.2K | 1586ms | ±2.3% |
|  | ioredis | 29.7K | 89.0K | 3371ms | ±2.6% |
| **List Range: LPUSH + RPUSH + LRANGE**<br/><sub>1 KB</sub> | **solidis** | 53.8K | 161.4K | 1858ms | ±10.6% |
|  | ioredis | 27.1K | 81.4K | 3687ms | ±0.9% |
| **Hash Mutation: HMSET + HMGET + HDEL**<br/><sub>1 KB</sub> | **solidis** | 56.2K | 168.6K | 1780ms | ±5.7% |
|  | ioredis | 29.4K | 88.3K | 3397ms | ±1.0% |
| **List Mutation: LPUSH + RPUSH + LPOP + RPOP + LLEN**<br/><sub>1 KB</sub> | **solidis** | 43.6K | 218.0K | 2294ms | ±1.3% |
|  | ioredis | 22.9K | 114.3K | 4375ms | ±1.5% |
| **Multi-Key: MSET + MGET**<br/><sub>1 KB</sub> | **solidis** | 58.0K | 115.9K | 1725ms | ±7.9% |
|  | ioredis | 31.4K | 62.8K | 3186ms | ±4.8% |
| **Set: SET**<br/><sub>1 KB</sub> | **solidis** | 137.7K | 137.7K | 726ms | ±2.8% |
|  | ioredis | 76.7K | 76.7K | 1304ms | ±4.7% |
| **Sorted Set: ZADD + ZRANGE + ZREM**<br/><sub>1 KB</sub> | **solidis** | 55.2K | 165.7K | 1811ms | ±7.2% |
|  | ioredis | 31.0K | 93.0K | 3228ms | ±0.7% |
| **Expire: SET + EXPIRE + TTL**<br/><sub>1 KB</sub> | **solidis** | 67.4K | 202.3K | 1483ms | ±2.4% |
|  | ioredis | 37.8K | 113.5K | 2642ms | ±2.4% |
| **Stream: XADD + XRANGE + XLEN**<br/><sub>1 KB</sub> | **solidis** | 56.5K | 169.4K | 1771ms | ±6.6% |
|  | ioredis | 32.0K | 96.0K | 3125ms | ±2.8% |
| **Set Read: SADD + SISMEMBER + SMEMBERS**<br/><sub>1 KB</sub> | **solidis** | 65.9K | 197.7K | 1518ms | ±4.1% |
|  | ioredis | 37.8K | 113.4K | 2646ms | ±1.6% |
| **Non-Transaction: SETPX + GET**<br/><sub>1 KB</sub> | **solidis** | 77.3K | 154.5K | 1294ms | ±5.9% |
|  | ioredis | 45.8K | 91.6K | 2184ms | ±1.4% |
| **Pipeline Mixed: SET + INCR + GET**<br/><sub>1 KB</sub> | **solidis** | 56.3K | 169.0K | 1775ms | ±5.4% |
|  | ioredis | 34.7K | 104.0K | 2884ms | ±4.6% |
| **Hash Round-Trip: HSET + HGET + HGETALL**<br/><sub>1 KB</sub> | **solidis** | 57.2K | 171.5K | 1749ms | ±5.6% |
|  | ioredis | 36.8K | 110.3K | 2720ms | ±1.2% |
| **Counter: INCR + DECR**<br/><sub>1 KB</sub> | **solidis** | 106.9K | 213.7K | 936ms | ±2.8% |
|  | ioredis | 69.8K | 139.6K | 1432ms | ±1.0% |
| **Get Buffer: GETBUFFER**<br/><sub>1 KB</sub> | **solidis** | 155.9K | 155.9K | 641ms | ±2.4% |
|  | ioredis | 111.8K | 111.8K | 894ms | ±3.5% |

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
| Date | 2026-06-17 15:28:53 |

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
