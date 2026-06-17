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

<small>Generated on 2026-06-17 14:36:24 · linux x64 · Node.js v22.22.3</small>
### Up to **108% faster** than ioredis! 🚀

---
<br/>

**15** / **15** benchmarks won · **77%** average speed improvement · **108%** peak speed improvement

*100,000 iterations × 10000 concurrency · 1 KB payload · 10 repeats*

| | Benchmark | Commands | solidis | ioredis | Difference | Performance |
|---:|:---|:---:|:---:|:---:|:---:|:---|
| 🥇 | **Set Mutation** | SADD + SISMEMBER + SREM | **1661ms** | 3460ms | **+108%** 🔥🔥 | `██████████` |
| 🥈 | **List Mutation** | LPUSH + RPUSH + LPOP + RPOP + LLEN | **2525ms** | 4989ms | **+98%** 🔥🔥 | `█████████░` |
| 🥉 | **List Range** | LPUSH + RPUSH + LRANGE | **1846ms** | 3620ms | **+96%** 🔥🔥 | `█████████░` |
| 4. | **Multi-Key** | MSET + MGET | **1799ms** | 3375ms | **+88%** 🔥🔥 | `████████░░` |
| 5. | **Hash Mutation** | HMSET + HMGET + HDEL | **1843ms** | 3450ms | **+87%** 🔥🔥 | `████████░░` |
| 6. | **Sorted Set** | ZADD + ZRANGE + ZREM | **1814ms** | 3311ms | **+83%** 🔥🔥 | `████████░░` |
| 7. | **Set** | SET | **745ms** | 1334ms | **+79%** 🔥🔥 | `███████░░░` |
| 8. | **Set Read** | SADD + SISMEMBER + SMEMBERS | **1794ms** | 3176ms | **+77%** 🔥🔥 | `███████░░░` |
| 9. | **Stream** | XADD + XRANGE + XLEN | **1848ms** | 3249ms | **+76%** 🔥🔥 | `███████░░░` |
| 10. | **Expire** | SET + EXPIRE + TTL | **1506ms** | 2612ms | **+73%** 🔥🔥 | `███████░░░` |
| 11. | **Non-Transaction** | SETPX + GET | **1288ms** | 2206ms | **+71%** 🔥🔥 | `███████░░░` |
| 12. | **Pipeline Mixed** | SET + INCR + GET | **1548ms** | 2482ms | **+60%** 🔥🔥 | `██████░░░░` |
| 13. | **Hash Round-Trip** | HSET + HGET + HGETALL | **1773ms** | 2740ms | **+55%** 🔥 | `█████░░░░░` |
| 14. | **Counter** | INCR + DECR | **1014ms** | 1561ms | **+54%** 🔥 | `█████░░░░░` |
| 15. | **Get Buffer** | GETBUFFER | **612ms** | 882ms | **+44%** 🔥 | `████░░░░░░` |

### Non Strictly Comparable Benchmarks

<sub>These benchmarks have library-specific behavior that prevents a strictly fair comparison.</sub>

| | Benchmark | Commands | solidis | ioredis | Difference | Performance |
|---:|:---|:---:|:---:|:---:|:---:|:---|
| 16. | **Transaction** | SET + EXPIRE + GET | 1347ms | 5338ms | **+296%** 🔥🔥 | `██████████` |
| 17. | **Transaction Mixed** | SET + GET | 1753ms | 6474ms | **+269%** 🔥🔥 | `██████████` |
| 18. | **Pub/Sub** | PUBLISH + MESSAGE | 732ms | 2661ms | **+264%** 🔥🔥 | `██████████` |
| 19. | **Info / Config** | INFO + CONFIGGET | 1109ms | 2027ms | **+83%** 🔥🔥 | `████████░░` |

<sub>Ranked by performance gain of `solidis` over `ioredis` (baseline). Elapsed = median time across repeats.</sub>

</div>

<br/>

## 📊 Detailed Metrics

<sub>All metrics per library: operations/s, commands/s, median elapsed time, and spread (coefficient of variation).</sub>

<details>
<summary>Click to expand detailed metrics table</summary>

| Benchmark | Library | ops/s | cmds/s | Elapsed | Spread |
|:---|:---|---:|---:|---:|---:|
| **Set Mutation: SADD + SISMEMBER + SREM**<br/><sub>1 KB</sub> | **solidis** | 60.2K | 180.6K | 1661ms | ±7.1% |
|  | ioredis | 28.9K | 86.7K | 3460ms | ±2.2% |
| **List Mutation: LPUSH + RPUSH + LPOP + RPOP + LLEN**<br/><sub>1 KB</sub> | **solidis** | 39.6K | 198.1K | 2525ms | ±4.9% |
|  | ioredis | 20.0K | 100.2K | 4989ms | ±2.5% |
| **List Range: LPUSH + RPUSH + LRANGE**<br/><sub>1 KB</sub> | **solidis** | 54.2K | 162.5K | 1846ms | ±9.2% |
|  | ioredis | 27.6K | 82.9K | 3620ms | ±0.6% |
| **Multi-Key: MSET + MGET**<br/><sub>1 KB</sub> | **solidis** | 55.6K | 111.2K | 1799ms | ±4.4% |
|  | ioredis | 29.6K | 59.3K | 3375ms | ±4.1% |
| **Hash Mutation: HMSET + HMGET + HDEL**<br/><sub>1 KB</sub> | **solidis** | 54.3K | 162.8K | 1843ms | ±9.1% |
|  | ioredis | 29.0K | 87.0K | 3450ms | ±2.4% |
| **Sorted Set: ZADD + ZRANGE + ZREM**<br/><sub>1 KB</sub> | **solidis** | 55.1K | 165.4K | 1814ms | ±11.3% |
|  | ioredis | 30.2K | 90.6K | 3311ms | ±1.4% |
| **Set: SET**<br/><sub>1 KB</sub> | **solidis** | 134.2K | 134.2K | 745ms | ±9.3% |
|  | ioredis | 75.0K | 75.0K | 1334ms | ±1.9% |
| **Set Read: SADD + SISMEMBER + SMEMBERS**<br/><sub>1 KB</sub> | **solidis** | 55.7K | 167.2K | 1794ms | ±10.1% |
|  | ioredis | 31.5K | 94.5K | 3176ms | ±2.6% |
| **Stream: XADD + XRANGE + XLEN**<br/><sub>1 KB</sub> | **solidis** | 54.1K | 162.4K | 1848ms | ±4.8% |
|  | ioredis | 30.8K | 92.3K | 3249ms | ±2.2% |
| **Expire: SET + EXPIRE + TTL**<br/><sub>1 KB</sub> | **solidis** | 66.4K | 199.2K | 1506ms | ±9.6% |
|  | ioredis | 38.3K | 114.9K | 2612ms | ±1.9% |
| **Non-Transaction: SETPX + GET**<br/><sub>1 KB</sub> | **solidis** | 77.6K | 155.2K | 1288ms | ±9.3% |
|  | ioredis | 45.3K | 90.7K | 2206ms | ±1.3% |
| **Pipeline Mixed: SET + INCR + GET**<br/><sub>1 KB</sub> | **solidis** | 64.6K | 193.8K | 1548ms | ±5.4% |
|  | ioredis | 40.3K | 120.9K | 2482ms | ±1.2% |
| **Hash Round-Trip: HSET + HGET + HGETALL**<br/><sub>1 KB</sub> | **solidis** | 56.4K | 169.2K | 1773ms | ±5.2% |
|  | ioredis | 36.5K | 109.5K | 2740ms | ±1.1% |
| **Counter: INCR + DECR**<br/><sub>1 KB</sub> | **solidis** | 98.6K | 197.1K | 1014ms | ±2.0% |
|  | ioredis | 64.1K | 128.1K | 1561ms | ±1.1% |
| **Get Buffer: GETBUFFER**<br/><sub>1 KB</sub> | **solidis** | 163.5K | 163.5K | 612ms | ±5.3% |
|  | ioredis | 113.4K | 113.4K | 882ms | ±2.3% |

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
| Date | 2026-06-17 14:36:24 |

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
