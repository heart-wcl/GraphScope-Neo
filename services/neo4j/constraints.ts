/**
 * Constraint Management Service
 * 约束管理 - 唯一性约束、存在性约束、节点键约束
 */

import type { Driver } from 'neo4j-driver';

export interface Constraint {
  name: string;
  type: 'UNIQUENESS' | 'NODE_KEY' | 'NODE_PROPERTY_EXISTENCE' | 'RELATIONSHIP_PROPERTY_EXISTENCE';
  entityType: 'NODE' | 'RELATIONSHIP';
  labelsOrTypes: string[];
  properties: string[];
  ownedIndex?: string;
}

export interface ConstraintCreateOptions {
  ifNotExists?: boolean;
}

/**
 * 获取所有约束
 */
export async function getConstraints(
  driver: Driver,
  database?: string
): Promise<Constraint[]> {
  const session = driver.session(database ? { database } : undefined);
  
  try {
    const result = await session.run('SHOW CONSTRAINTS');
    
    return result.records.map(record => ({
      name: record.get('name'),
      type: record.get('type'),
      entityType: record.get('entityType'),
      labelsOrTypes: record.get('labelsOrTypes') || [],
      properties: record.get('properties') || [],
      ownedIndex: record.get('ownedIndex')
    }));
  } finally {
    await session.close();
  }
}

/**
 * 获取指定标签的约束
 */
export async function getConstraintsForLabel(
  driver: Driver,
  label: string,
  database?: string
): Promise<Constraint[]> {
  const constraints = await getConstraints(driver, database);
  return constraints.filter(c => c.labelsOrTypes.includes(label));
}

/**
 * 创建唯一性约束
 */
export async function createUniqueConstraint(
  driver: Driver,
  label: string,
  property: string,
  constraintName?: string,
  options: ConstraintCreateOptions = {},
  database?: string
): Promise<void> {
  const session = driver.session(database ? { database } : undefined);
  const name = constraintName || `${label.toLowerCase()}_${property}_unique`;
  const ifNotExists = options.ifNotExists ? ' IF NOT EXISTS' : '';
  
  try {
    await session.run(`
      CREATE CONSTRAINT ${name}${ifNotExists}
      FOR (n:\`${label}\`)
      REQUIRE n.\`${property}\` IS UNIQUE
    `);
  } finally {
    await session.close();
  }
}

/**
 * 创建存在性约束 (节点属性)
 */
export async function createNodeExistenceConstraint(
  driver: Driver,
  label: string,
  property: string,
  constraintName?: string,
  options: ConstraintCreateOptions = {},
  database?: string
): Promise<void> {
  const session = driver.session(database ? { database } : undefined);
  const name = constraintName || `${label.toLowerCase()}_${property}_exists`;
  const ifNotExists = options.ifNotExists ? ' IF NOT EXISTS' : '';
  
  try {
    await session.run(`
      CREATE CONSTRAINT ${name}${ifNotExists}
      FOR (n:\`${label}\`)
      REQUIRE n.\`${property}\` IS NOT NULL
    `);
  } finally {
    await session.close();
  }
}

/**
 * 创建存在性约束 (关系属性)
 */
export async function createRelationshipExistenceConstraint(
  driver: Driver,
  relType: string,
  property: string,
  constraintName?: string,
  options: ConstraintCreateOptions = {},
  database?: string
): Promise<void> {
  const session = driver.session(database ? { database } : undefined);
  const name = constraintName || `${relType.toLowerCase()}_${property}_exists`;
  const ifNotExists = options.ifNotExists ? ' IF NOT EXISTS' : '';
  
  try {
    await session.run(`
      CREATE CONSTRAINT ${name}${ifNotExists}
      FOR ()-[r:\`${relType}\`]-()
      REQUIRE r.\`${property}\` IS NOT NULL
    `);
  } finally {
    await session.close();
  }
}

/**
 * 创建节点键约束 (多属性唯一性)
 */
export async function createNodeKeyConstraint(
  driver: Driver,
  label: string,
  properties: string[],
  constraintName?: string,
  options: ConstraintCreateOptions = {},
  database?: string
): Promise<void> {
  const session = driver.session(database ? { database } : undefined);
  const name = constraintName || `${label.toLowerCase()}_${properties.join('_')}_key`;
  const propsStr = properties.map(p => `n.\`${p}\``).join(', ');
  const ifNotExists = options.ifNotExists ? ' IF NOT EXISTS' : '';
  
  try {
    await session.run(`
      CREATE CONSTRAINT ${name}${ifNotExists}
      FOR (n:\`${label}\`)
      REQUIRE (${propsStr}) IS NODE KEY
    `);
  } finally {
    await session.close();
  }
}

/**
 * 删除约束
 */
export async function dropConstraint(
  driver: Driver,
  constraintName: string,
  ifExists: boolean = true,
  database?: string
): Promise<void> {
  const session = driver.session(database ? { database } : undefined);
  const ifExistsStr = ifExists ? ' IF EXISTS' : '';
  
  try {
    await session.run(`DROP CONSTRAINT ${constraintName}${ifExistsStr}`);
  } finally {
    await session.close();
  }
}

/**
 * 检查约束是否存在
 */
export async function constraintExists(
  driver: Driver,
  constraintName: string,
  database?: string
): Promise<boolean> {
  const constraints = await getConstraints(driver, database);
  return constraints.some(c => c.name === constraintName);
}

/**
 * 验证数据是否符合约束
 */
export async function validateConstraints(
  driver: Driver,
  database?: string
): Promise<{ valid: boolean; violations: string[] }> {
  const session = driver.session(database ? { database } : undefined);
  const violations: string[] = [];
  
  try {
    // 获取所有约束
    const constraints = await getConstraints(driver, database);
    
    for (const constraint of constraints) {
      if (constraint.type === 'UNIQUENESS') {
        // 检查唯一性约束违规
        const label = constraint.labelsOrTypes[0];
        const prop = constraint.properties[0];
        
        const result = await session.run(`
          MATCH (n:\`${label}\`)
          WITH n.\`${prop}\` as val, count(*) as cnt
          WHERE cnt > 1
          RETURN val, cnt
        `);
        
        if (result.records.length > 0) {
          result.records.forEach(record => {
            violations.push(
              `Uniqueness violation: ${label}.${prop} = "${record.get('val')}" appears ${record.get('cnt')} times`
            );
          });
        }
      }
      
      if (constraint.type === 'NODE_PROPERTY_EXISTENCE') {
        // 检查存在性约束违规
        const label = constraint.labelsOrTypes[0];
        const prop = constraint.properties[0];
        
        const result = await session.run(`
          MATCH (n:\`${label}\`)
          WHERE n.\`${prop}\` IS NULL
          RETURN count(n) as cnt
        `);
        
        const count = result.records[0]?.get('cnt')?.toNumber() || 0;
        if (count > 0) {
          violations.push(
            `Existence violation: ${count} ${label} nodes have NULL ${prop}`
          );
        }
      }
    }
    
    return {
      valid: violations.length === 0,
      violations
    };
  } finally {
    await session.close();
  }
}
