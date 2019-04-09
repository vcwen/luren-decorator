import 'reflect-metadata'
import { Prop, Schema } from '../../src'
import { MetadataKey } from '../../src/constants/MetadataKey'
describe('Schema', () => {
  it('should build schema with props', () => {
    @Schema()
    class Test {
      @Prop({ required: true })
      public name!: string
      @Prop({ schema: { type: 'number' } })
      public age?: number
    }
    const metadata = Reflect.getMetadata(MetadataKey.SCHEMA, Test.prototype)
    expect(metadata).toEqual(
      expect.objectContaining({
        id: 'Test',
        schema: {
          type: 'object',
          constructor: expect.any(Function),
          properties: {
            name: {
              name: 'name',
              type: 'string'
            },
            age: {
              name: 'age',
              type: 'number'
            }
          },
          required: ['name']
        },
        strict: true
      })
    )
  })
})