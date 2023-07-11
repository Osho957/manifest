import { Injectable, NotFoundException } from '@nestjs/common'
import {
  DataSource,
  EntityMetadata,
  FindOptionsWhere,
  In,
  Repository
} from 'typeorm'
import { RelationMetadata } from 'typeorm/metadata/RelationMetadata'
import { SelectOption } from '../../../shared/interfaces/select-option.interface'

@Injectable()
export class DynamicEntityService {
  constructor(private dataSource: DataSource) {}

  findAll(
    entitySlug: string,
    queryParams?: { [key: string]: string | string[] }
  ): Promise<any[]> {
    const entityRepository: Repository<any> = this.getRepository(entitySlug)

    // Get entity relations
    const entity: EntityMetadata = this.dataSource.entityMetadatas.find(
      (entity: EntityMetadata) =>
        (entity.target as any).definition.slug === entitySlug
    )

    const relations: string[] = entity.relations.map(
      (relation: RelationMetadata) => relation.propertyName
    )

    // Dynamic filtering.
    const where: FindOptionsWhere<any> = {}

    Object.keys(queryParams || {}).forEach((key: string) => {
      // Check if key is a relation.
      if (relations.includes(key)) {
        // Force array.
        if (typeof queryParams[key] === 'string') {
          queryParams[key] = [queryParams[key] as string]
        }
        // Add relation where clause: { relation: In([1, 2, 3])  }
        where[key] = In(queryParams[key] as string[])
      }
    })

    return entityRepository.find({
      order: { id: 'DESC' },
      relations,
      where
    })
  }

  async findSelectOptions(entitySlug: string): Promise<SelectOption[]> {
    const items: any[] = await this.findAll(entitySlug)

    // Get entity propIdentifier.
    const entity: EntityMetadata = this.dataSource.entityMetadatas.find(
      (entity: EntityMetadata) =>
        (entity.target as any).definition.slug === entitySlug
    )

    return items.map((item: any) => ({
      id: item.id,
      label: item[(entity.target as any).definition.propIdentifier]
    }))
  }

  async findOne(entitySlug: string, id: number) {
    const entity: EntityMetadata = this.dataSource.entityMetadatas.find(
      (entity: EntityMetadata) =>
        (entity.target as any).definition.slug === entitySlug
    )

    const item = await this.getRepository(entitySlug).findOne({
      where: { id },
      relations: entity.relations.map(
        (relation: RelationMetadata) => relation.propertyName
      )
    })

    if (!item) {
      throw new NotFoundException('Item not found')
    }
    return item
  }

  async store(entitySlug: string, entityDto: any) {
    const entityRepository: Repository<any> = this.getRepository(entitySlug)

    const item = entityRepository.create(entityDto)

    return entityRepository.insert(item)
  }

  async update(entitySlug: string, id: number, entityDto: any) {
    const entityRepository: Repository<any> = this.getRepository(entitySlug)

    const item = await entityRepository.findOne({ where: { id } })

    if (!item) {
      throw new NotFoundException('Item not found')
    }

    return entityRepository.update(id, entityDto)
  }

  async delete(entitySlug: string, id: number) {
    const entityRepository: Repository<any> = this.getRepository(entitySlug)

    const item = await entityRepository.findOne({ where: { id } })

    if (!item) {
      throw new NotFoundException('Item not found')
    }

    return entityRepository.delete(id)
  }

  private getRepository(entitySlug: string): Repository<any> {
    const entity: EntityMetadata = this.dataSource.entityMetadatas.find(
      (entity: EntityMetadata) =>
        (entity.target as any).definition.slug === entitySlug
    )

    if (!entity) {
      throw new NotFoundException('Entity not found')
    }

    return this.dataSource.getRepository(entity.target)
  }
}
