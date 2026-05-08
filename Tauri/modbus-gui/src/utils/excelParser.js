/**
 * Excel 配置文件解析器
 * 将 xlsx 文件解析为结构化的 Sheet → 条目列表
 */
import * as XLSX from 'xlsx'

/**
 * 解析 SELECT 选项字段
 * 支持格式：[{label:'x1', value:'v1'}, ...]
 * 也支持 JSON 标准格式
 */
function parseSelectOptions(raw) {
  if (!raw || typeof raw !== 'string') return []
  try {
    // 替换单引号为双引号，兼容 JS 对象字面量格式
    const normalized = raw
      .replace(/'/g, '"')
      .replace(/([{,]\s*)(\w+)\s*:/g, '$1"$2":') // key 加引号
    return JSON.parse(normalized)
  } catch {
    console.warn('解析 SELECT 选项失败:', raw)
    return []
  }
}

/**
 * 解析单行数据为条目对象
 * 列映射（不区分大小写、首尾空格）：
 *   name | 名称 → name
 *   寄存器地址 | register | address → register
 *   小数位数 | decimal | decimals → decimals
 *   单位 | unit → unit
 *   读写权限 | permission | rw → permission  (READONLY / READWRITE)
 *   组件类型 | type | widget → type  (INPUT / SELECT)
 *   选项数据 | options → options
 */
function parseRow(row, headers) {
  const get = (...keys) => {
    for (const k of keys) {
      const found = headers.find(h => h.toLowerCase() === k.toLowerCase())
      if (found !== undefined && row[found] !== undefined && row[found] !== null && row[found] !== '') {
        return String(row[found]).trim()
      }
    }
    return ''
  }

  const name       = get('name', '名称', '标题')
  const register   = get('寄存器地址', 'register', 'address', '地址')
  const decimals   = parseInt(get('小数位数', 'decimal', 'decimals', '精度') || '0', 10)
  const unit       = get('单位', 'unit')
  const permission = get('读写权限', 'permission', 'rw', '权限').toUpperCase() || 'READONLY'
  const type       = get('组件类型', 'type', 'widget', '类型').toUpperCase() || 'INPUT'
  const optionsRaw = get('选项数据', 'options', '选项')

  if (!name && !register) return null

  return {
    id:         `${register}_${name}`,
    name,
    register:   register ? parseInt(register, 10) : null,
    decimals:   isNaN(decimals) ? 0 : decimals,
    unit,
    permission, // READONLY | READWRITE
    type,       // INPUT | SELECT
    options:    type === 'SELECT' ? parseSelectOptions(optionsRaw) : [],
    // 运行时状态（预留给 Modbus 轮询更新）
    value:      null,
    rawValue:   null,
    loading:    false,
    error:      null,
  }
}

/**
 * 从文件对象解析配置
 * @param {File} file - 用户选择的 xlsx 文件
 * @returns {Promise<{ sheets: Array<{ name: string, items: Array }> }>}
 */
export async function parseConfigFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result)
        const workbook = XLSX.read(data, { type: 'array' })

        const sheets = []

        for (const sheetName of workbook.SheetNames) {
          const worksheet = workbook.Sheets[sheetName]
          // header: 1 → 返回二维数组; header: 'A' → 列名作 key
          // 我们用 header: 1 自己处理首行作列名
          const rows = XLSX.utils.sheet_to_json(worksheet, {
            header: 1,
            defval: '',
            blankrows: false,
          })

          if (rows.length < 2) {
            // 空 sheet 或只有表头，跳过但保留（可能用户想要空页签）
            sheets.push({ name: sheetName, items: [] })
            continue
          }

          // 第一行作为列名
          const headers = rows[0].map(h => String(h).trim())
          const items = []

          for (let i = 1; i < rows.length; i++) {
            const rowObj = {}
            headers.forEach((h, idx) => {
              rowObj[h] = rows[i][idx] !== undefined ? rows[i][idx] : ''
            })
            const item = parseRow(rowObj, headers)
            if (item) items.push(item)
          }

          sheets.push({ name: sheetName, items })
        }

        resolve({ sheets })
      } catch (err) {
        reject(new Error(`Excel 解析失败: ${err.message}`))
      }
    }

    reader.onerror = () => reject(new Error('文件读取失败'))
    reader.readAsArrayBuffer(file)
  })
}

/**
 * 生成示例配置文件（用于开发调试）
 */
export function generateSampleConfig() {
  const wb = XLSX.utils.book_new()

  // Sheet1: 电机参数
  const sheet1Data = [
    ['name', '寄存器地址', '小数位数', '单位', '读写权限', '组件类型', '选项数据'],
    ['电机转速',    40001, 1, 'RPM',  'READONLY',  'INPUT', ''],
    ['运行电流',    40002, 2, 'A',    'READONLY',  'INPUT', ''],
    ['母线电压',    40003, 1, 'V',    'READONLY',  'INPUT', ''],
    ['输出功率',    40004, 2, 'kW',   'READONLY',  'INPUT', ''],
    ['目标转速',    40005, 1, 'RPM',  'READWRITE', 'INPUT', ''],
    ['加速时间',    40006, 1, 's',    'READWRITE', 'INPUT', ''],
    ['减速时间',    40007, 1, 's',    'READWRITE', 'INPUT', ''],
    ['运行状态',    40008, 0, '',     'READONLY',  'SELECT', "[{\"label\":\"停机\",\"value\":\"0\"},{\"label\":\"运行\",\"value\":\"1\"},{\"label\":\"故障\",\"value\":\"2\"}]"],
    ['控制模式',    40009, 0, '',     'READWRITE', 'SELECT', "[{\"label\":\"速度控制\",\"value\":\"0\"},{\"label\":\"转矩控制\",\"value\":\"1\"},{\"label\":\"位置控制\",\"value\":\"2\"}]"],
    ['散热器温度',  40010, 1, '°C',   'READONLY',  'INPUT', ''],
    ['故障代码',    40011, 0, '',     'READONLY',  'INPUT', ''],
    ['累计运行时间',40012, 0, 'h',    'READONLY',  'INPUT', ''],
  ]

  // Sheet2: 变频器参数
  const sheet2Data = [
    ['name', '寄存器地址', '小数位数', '单位', '读写权限', '组件类型', '选项数据'],
    ['载波频率',    40029, 1, 'kHz',  'READWRITE', 'INPUT', ''],
    ['最高频率',    40030, 2, 'Hz',   'READWRITE', 'INPUT', ''],
    ['最低频率',    40031, 2, 'Hz',   'READWRITE', 'INPUT', ''],
    ['额定电压',    40032, 0, 'V',    'READONLY',  'INPUT', ''],
    ['额定电流',    40033, 1, 'A',    'READONLY',  'INPUT', ''],
    ['电机极对数',  40034, 0, 'p',    'READWRITE', 'INPUT', ''],
    ['过载保护',    40035, 0, '%',    'READWRITE', 'INPUT', ''],
    ['启动方式',    40036, 0, '',     'READWRITE', 'SELECT', "[{\"label\":\"直接启动\",\"value\":\"0\"},{\"label\":\"软启动\",\"value\":\"1\"},{\"label\":\"飞车启动\",\"value\":\"2\"}]"],
    ['制动方式',    40037, 0, '',     'READWRITE', 'SELECT', "[{\"label\":\"自由停车\",\"value\":\"0\"},{\"label\":\"减速停车\",\"value\":\"1\"},{\"label\":\"直流制动\",\"value\":\"2\"}]"],
    ['PID比例增益', 40038, 2, '',     'READWRITE', 'INPUT', ''],
    ['PID积分时间', 40039, 2, 's',    'READWRITE', 'INPUT', ''],
  ]

  // Sheet3: 保护参数
  const sheet3Data = [
    ['name', '寄存器地址', '小数位数', '单位', '读写权限', '组件类型', '选项数据'],
    ['过压保护值',  40050, 0, 'V',    'READWRITE', 'INPUT', ''],
    ['欠压保护值',  40051, 0, 'V',    'READWRITE', 'INPUT', ''],
    ['过流保护值',  40052, 1, 'A',    'READWRITE', 'INPUT', ''],
    ['过温保护值',  40053, 0, '°C',   'READWRITE', 'INPUT', ''],
    ['接地故障保护',40054, 0, '',     'READWRITE', 'SELECT', "[{\"label\":\"禁用\",\"value\":\"0\"},{\"label\":\"启用\",\"value\":\"1\"}]"],
    ['缺相保护',    40055, 0, '',     'READWRITE', 'SELECT', "[{\"label\":\"禁用\",\"value\":\"0\"},{\"label\":\"启用\",\"value\":\"1\"}]"],
  ]

  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(sheet1Data), '电机参数')
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(sheet2Data), '变频器参数')
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(sheet3Data), '保护参数')

  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
  return new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
}

/**
 * 数值换算工具
 */
export function rawToDisplay(rawValue, decimals) {
  if (rawValue === null || rawValue === undefined) return ''
  const divisor = Math.pow(10, decimals)
  return (rawValue / divisor).toFixed(decimals)
}

export function displayToRaw(displayValue, decimals) {
  const multiplier = Math.pow(10, decimals)
  return Math.round(parseFloat(displayValue) * multiplier)
}
