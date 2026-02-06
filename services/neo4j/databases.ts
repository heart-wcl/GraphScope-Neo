/**
 * Database Management Service
 * 多数据库管理 - 列表、创建、删除、状态监控
 */

import type { Driver } from 'neo4j-driver';

export interface DatabaseInfo {
  name: string;
  type: string;
  access: string;
  address: string;
  role: string;
  requestedStatus: string;
  currentStatus: string;
  statusMessage: string;
  default: boolean;
  home: boolean;
}

export interface DatabaseStatistics {
  nodeCount: number;
  relationshipCount: number;
  labelCount: number;
  relationshipTypeCount: number;
  propertyKeyCount: number;
  storeSizeBytes?: number;
}

/**
 * 安全获取记录字段值
 */
function safeGet(record: any, key: string, defaultValue: any = ''): any {
  try {
    const keys = record.keys || [];
    if (keys.includes(key)) {
      return record.get(key) ?? defaultValue;
    }
    return defaultValue;
  } catch {
    return defaultValue;
  }
}

/**
 * 列出所有数据库
 */
export async function listDatabases(driver: Driver): Promise<DatabaseInfo[]> {
  const session = driver.session({ database: 'system' });
  
  try {
    const result = await session.run('SHOW DATABASES');
    
    return result.records.map(record => ({
      name: safeGet(record, 'name', 'unknown'),
      type: safeGet(record, 'type', 'standard'),
      access: safeGet(record, 'access', 'read-write'),
      address: safeGet(record, 'address', 'localhost'),
      role: safeGet(record, 'role', 'standalone'),
      requestedStatus: safeGet(record, 'requestedStatus', 'online'),
      currentStatus: safeGet(record, 'currentStatus', 'online'),
      statusMessage: safeGet(record, 'statusMessage', ''),
      default: safeGet(record, 'default', false),
      home: safeGet(record, 'home', false)
    }));
  } finally {
    await session.close();
  }
}

/**
 * 获取当前数据库信息
 */
export async function getCurrentDatabase(driver: Driver): Promise<string> {
  const session = driver.session({ database: 'system' });
  
  try {
    const result = await session.run('SHOW DEFAULT DATABASE');
    return result.records[0]?.get('name') || 'neo4j';
  } finally {
    await session.close();
  }
}

/**
 * 创建数据库
 */
export async function createDatabase(
  driver: Driver,
  name: string,
  ifNotExists: boolean = true
): Promise<void> {
  const session = driver.session({ database: 'system' });
  const ifNotExistsClause = ifNotExists ? ' IF NOT EXISTS' : '';
  
  try {
    await session.run(`CREATE DATABASE \`${name}\`${ifNotExistsClause}`);
  } finally {
    await session.close();
  }
}

/**
 * 删除数据库
 */
export async function dropDatabase(
  driver: Driver,
  name: string,
  ifExists: boolean = true
): Promise<void> {
  const session = driver.session({ database: 'system' });
  const ifExistsClause = ifExists ? ' IF EXISTS' : '';
  
  try {
    await session.run(`DROP DATABASE \`${name}\`${ifExistsClause}`);
  } finally {
    await session.close();
  }
}

/**
 * 启动数据库
 */
export async function startDatabase(
  driver: Driver,
  name: string
): Promise<void> {
  const session = driver.session({ database: 'system' });
  
  try {
    await session.run(`START DATABASE \`${name}\``);
  } finally {
    await session.close();
  }
}

/**
 * 停止数据库
 */
export async function stopDatabase(
  driver: Driver,
  name: string
): Promise<void> {
  const session = driver.session({ database: 'system' });
  
  try {
    await session.run(`STOP DATABASE \`${name}\``);
  } finally {
    await session.close();
  }
}

/**
 * 设置默认数据库 (需要 Neo4j 4.3+)
 */
export async function setDefaultDatabase(
  driver: Driver,
  name: string
): Promise<void> {
  const session = driver.session({ database: 'system' });
  
  try {
    await session.run(`ALTER DATABASE \`${name}\` SET DEFAULT`);
  } finally {
    await session.close();
  }
}

/**
 * 获取数据库统计信息
 */
export async function getDatabaseStatistics(
  driver: Driver,
  database: string
): Promise<DatabaseStatistics> {
  const session = driver.session({ database });
  
  try {
    // Get node count
    const nodeResult = await session.run('MATCH (n) RETURN count(n) as count');
    const nodeCount = nodeResult.records[0]?.get('count')?.toNumber() || 0;
    
    // Get relationship count
    const relResult = await session.run('MATCH ()-[r]->() RETURN count(r) as count');
    const relationshipCount = relResult.records[0]?.get('count')?.toNumber() || 0;
    
    // Get label count
    const labelResult = await session.run('CALL db.labels() YIELD label RETURN count(label) as count');
    const labelCount = labelResult.records[0]?.get('count')?.toNumber() || 0;
    
    // Get relationship type count
    const relTypeResult = await session.run('CALL db.relationshipTypes() YIELD relationshipType RETURN count(relationshipType) as count');
    const relationshipTypeCount = relTypeResult.records[0]?.get('count')?.toNumber() || 0;
    
    // Get property key count
    const propResult = await session.run('CALL db.propertyKeys() YIELD propertyKey RETURN count(propertyKey) as count');
    const propertyKeyCount = propResult.records[0]?.get('count')?.toNumber() || 0;
    
    return {
      nodeCount,
      relationshipCount,
      labelCount,
      relationshipTypeCount,
      propertyKeyCount
    };
  } finally {
    await session.close();
  }
}

/**
 * 检查数据库是否存在
 */
export async function databaseExists(
  driver: Driver,
  name: string
): Promise<boolean> {
  const databases = await listDatabases(driver);
  return databases.some(db => db.name === name);
}

/**
 * 检查数据库是否在线
 */
export async function isDatabaseOnline(
  driver: Driver,
  name: string
): Promise<boolean> {
  const databases = await listDatabases(driver);
  const db = databases.find(d => d.name === name);
  return db?.currentStatus === 'online';
}

/**
 * 等待数据库上线
 */
export async function waitForDatabaseOnline(
  driver: Driver,
  name: string,
  timeoutMs: number = 30000
): Promise<boolean> {
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeoutMs) {
    if (await isDatabaseOnline(driver, name)) {
      return true;
    }
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  return false;
}

/**
 * 复制数据库 (需要 Neo4j 4.3+ Enterprise)
 */
export async function copyDatabase(
  driver: Driver,
  sourceName: string,
  targetName: string
): Promise<void> {
  const session = driver.session({ database: 'system' });
  
  try {
    await session.run(`CREATE DATABASE \`${targetName}\` FROM \`${sourceName}\``);
  } finally {
    await session.close();
  }
}

/**
 * 获取数据库服务器版本
 */
export async function getServerVersion(driver: Driver): Promise<string> {
  const session = driver.session();
  
  try {
    const result = await session.run('CALL dbms.components() YIELD versions RETURN versions[0] as version');
    return result.records[0]?.get('version') || 'unknown';
  } finally {
    await session.close();
  }
}

/**
 * 获取数据库服务器信息
 */
export async function getServerInfo(driver: Driver): Promise<{
  version: string;
  edition: string;
  name: string;
}> {
  const session = driver.session();
  
  try {
    const result = await session.run('CALL dbms.components() YIELD name, versions, edition RETURN name, versions[0] as version, edition');
    const record = result.records[0];
    return {
      name: record?.get('name') || 'Neo4j',
      version: record?.get('version') || 'unknown',
      edition: record?.get('edition') || 'community'
    };
  } finally {
    await session.close();
  }
}
