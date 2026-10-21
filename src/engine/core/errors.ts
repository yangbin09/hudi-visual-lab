/** 模拟引擎错误：用于「不符合配置约束的操作必须明确报错」 */
export class SimulationError extends Error {
  /** 命中的能力键 */
  capabilityKey?: string
  constructor(message: string, capabilityKey?: string) {
    super(message)
    this.name = 'SimulationError'
    this.capabilityKey = capabilityKey
  }
}
