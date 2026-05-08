/**
 * Modbus RTU 通信模块（预留桩）
 * 
 * 实际实现时，通过 Tauri invoke 调用 Rust 后端：
 *   import { invoke } from '@tauri-apps/api/core'
 *   await invoke('modbus_connect', { port, baudRate, ... })
 *   await invoke('modbus_read_register', { address })
 *   await invoke('modbus_write_register', { address, value })
 * 
 * 当前为 Mock 模式，用随机数模拟轮询读值
 */
import { ref, reactive } from 'vue'

export function useModbus() {
  const isConnected = ref(false)
  const isPolling = ref(false)
  const connectionError = ref(null)
  const stats = reactive({
    totalReads: 0,
    successReads: 0,
    failedReads: 0,
    lastPollTime: null,
    pollCycleMs: null,
  })

  // 串口配置
  const portConfig = reactive({
    port: '',
    baudRate: 9600,
    dataBits: 8,
    stopBits: 1,
    parity: 'None',
    slaveId: 1,
    pollInterval: 500, // ms，0 = 无等待
  })

  let pollTimer = null
  let pollCallback = null

  /**
   * 连接串口（预留 —— 调用 Tauri Rust 后端）
   */
  async function connect(config) {
    Object.assign(portConfig, config)
    connectionError.value = null
    try {
      // TODO: 实际实现
      // await invoke('modbus_connect', { ...portConfig })
      console.log('[Modbus] 连接参数:', portConfig)

      // Mock：模拟连接成功
      await new Promise(r => setTimeout(r, 500))
      isConnected.value = true
      return true
    } catch (err) {
      connectionError.value = err.message
      return false
    }
  }

  /**
   * 断开连接
   */
  async function disconnect() {
    stopPolling()
    // TODO: await invoke('modbus_disconnect')
    isConnected.value = false
  }

  /**
   * 读取单个寄存器（预留）
   * @param {number} address - Modbus 寄存器地址
   * @returns {Promise<number|null>} 原始寄存器值
   */
  async function readRegister(address) {
    try {
      // TODO: return await invoke('modbus_read_register', { address, slaveId: portConfig.slaveId })
      
      // Mock：随机模拟值
      await new Promise(r => setTimeout(r, 10))
      stats.totalReads++
      stats.successReads++
      
      // 模拟各地址的典型值（原始整数值）
      const mockValues = {
        40001: 14800 + Math.round((Math.random() - 0.5) * 100), // 转速 1480.x RPM
        40002: 1230 + Math.round((Math.random() - 0.5) * 20),   // 电流 12.30 A
        40003: 3800 + Math.round((Math.random() - 0.5) * 10),   // 电压 380.x V
        40004: 185 + Math.round((Math.random() - 0.5) * 5),     // 功率 1.85 kW
        40005: 15000,                                             // 目标转速 1500.0
        40006: 50,                                                // 加速时间 5.0s
        40007: 50,                                                // 减速时间 5.0s
        40008: 1,                                                 // 运行状态：运行
        40009: 0,                                                 // 控制模式：速度
        40010: 452 + Math.round((Math.random() - 0.5) * 10),    // 温度 45.2°C
        40011: 0,
        40012: 1200,
        40029: 40,
        40030: 5000,
        40031: 500,
        40032: 380,
        40033: 200,
        40034: 2,
        40035: 150,
        40036: 0,
        40037: 1,
        40038: 100,
        40039: 50,
      }
      return mockValues[address] !== undefined
        ? mockValues[address]
        : Math.round(Math.random() * 1000)
    } catch (err) {
      stats.totalReads++
      stats.failedReads++
      throw err
    }
  }

  /**
   * 写入单个寄存器（预留）
   * @param {number} address - Modbus 寄存器地址
   * @param {number} rawValue - 原始整数值
   */
  async function writeRegister(address, rawValue) {
    if (!isConnected.value) throw new Error('未连接')
    // TODO: await invoke('modbus_write_register', { address, value: rawValue, slaveId: portConfig.slaveId })
    console.log(`[Modbus] 写寄存器 ${address} = ${rawValue}`)
    await new Promise(r => setTimeout(r, 50)) // Mock 延迟
  }

  /**
   * 启动轮询
   * @param {Array} items - 条目列表（来自配置）
   * @param {Function} onUpdate - 回调 (itemId, rawValue)
   */
  function startPolling(items, onUpdate) {
    if (isPolling.value) stopPolling()
    pollCallback = onUpdate
    isPolling.value = true
    schedulePoll(items)
  }

  function stopPolling() {
    isPolling.value = false
    if (pollTimer) {
      clearTimeout(pollTimer)
      pollTimer = null
    }
  }

  async function schedulePoll(items) {
    if (!isPolling.value) return
    const start = Date.now()

    for (const item of items) {
      if (!isPolling.value) break
      if (item.register === null) continue
      try {
        const raw = await readRegister(item.register)
        if (pollCallback) pollCallback(item.id, raw)
        item.loading = false
        item.error = null
      } catch (err) {
        item.error = err.message
      }
    }

    const elapsed = Date.now() - start
    stats.lastPollTime = Date.now()
    stats.pollCycleMs = elapsed

    if (!isPolling.value) return

    const interval = portConfig.pollInterval
    if (interval <= 0) {
      // 无等待，立即下一轮
      pollTimer = setTimeout(() => schedulePoll(items), 0)
    } else {
      // 等待配置的间隔
      pollTimer = setTimeout(() => schedulePoll(items), interval)
    }
  }

  return {
    isConnected,
    isPolling,
    connectionError,
    portConfig,
    stats,
    connect,
    disconnect,
    readRegister,
    writeRegister,
    startPolling,
    stopPolling,
  }
}
