// seed/main.go — 写入示例学生数据（可独立运行）
// 用法: go run ./seed/main.go
package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
)

type Student struct {
	StudentID string `json:"student_id"`
	Name      string `json:"name"`
	Grade     string `json:"grade"`
	Class     string `json:"class"`
	Major     string `json:"major"`
	Gender    string `json:"gender"`
	Phone     string `json:"phone"`
	Email     string `json:"email"`
	BirthDate string `json:"birth_date"`
	Status    string `json:"status"`
}

func main() {
	baseURL := "http://localhost:8080/api/students"

	students := []Student{
		{"2024010001", "张伟",   "大一", "计算机2401", "计算机科学与技术", "male",   "13800000001", "zhang.wei@edu.cn",   "2006-03-15", "active"},
		{"2024010002", "李婷",   "大一", "计算机2401", "计算机科学与技术", "female", "13800000002", "li.ting@edu.cn",     "2006-07-22", "active"},
		{"2024010003", "王强",   "大一", "软工2401",   "软件工程",         "male",   "13800000003", "wang.qiang@edu.cn",  "2005-11-08", "active"},
		{"2024020001", "陈雪",   "大一", "数学2401",   "应用数学",         "female", "13800000004", "chen.xue@edu.cn",    "2006-01-30", "active"},
		{"2023010001", "刘洋",   "大二", "计算机2301", "计算机科学与技术", "male",   "13800000005", "liu.yang@edu.cn",    "2005-05-18", "active"},
		{"2023010002", "赵敏",   "大二", "计算机2301", "计算机科学与技术", "female", "13800000006", "zhao.min@edu.cn",    "2005-09-04", "active"},
		{"2023020001", "孙磊",   "大二", "软工2301",   "软件工程",         "male",   "13800000007", "sun.lei@edu.cn",     "2005-02-14", "active"},
		{"2023030001", "周芳",   "大二", "电子2301",   "电子信息工程",     "female", "13800000008", "zhou.fang@edu.cn",   "2005-06-25", "active"},
		{"2022010001", "吴刚",   "大三", "计算机2201", "计算机科学与技术", "male",   "13800000009", "wu.gang@edu.cn",     "2004-10-11", "active"},
		{"2022010002", "郑丽",   "大三", "计算机2201", "计算机科学与技术", "female", "13800000010", "zheng.li@edu.cn",    "2004-12-03", "active"},
		{"2022020001", "冯涛",   "大三", "数学2201",   "应用数学",         "male",   "13800000011", "feng.tao@edu.cn",    "2004-04-19", "active"},
		{"2022030001", "蒋云",   "大三", "机械2201",   "机械工程",         "female", "13800000012", "jiang.yun@edu.cn",   "2004-08-07", "active"},
		{"2021010001", "何宇",   "大四", "计算机2101", "计算机科学与技术", "male",   "13800000013", "he.yu@edu.cn",       "2003-01-23", "active"},
		{"2021010002", "林晓",   "大四", "计算机2101", "计算机科学与技术", "female", "13800000014", "lin.xiao@edu.cn",    "2003-07-16", "active"},
		{"2021020001", "杨帆",   "大四", "软工2101",   "软件工程",         "male",   "13800000015", "yang.fan@edu.cn",    "2003-03-29", "suspended"},
	}

	success, fail := 0, 0
	for _, s := range students {
		b, _ := json.Marshal(s)
		resp, err := http.Post(baseURL, "application/json", bytes.NewReader(b))
		if err != nil {
			log.Printf("SKIP %s: %v\n", s.StudentID, err)
			fail++
			continue
		}
		resp.Body.Close()
		if resp.StatusCode == 201 {
			success++
			fmt.Printf("  ✅ %s %s\n", s.StudentID, s.Name)
		} else {
			fmt.Printf("  ⚠️  %s %s (status %d)\n", s.StudentID, s.Name, resp.StatusCode)
			fail++
		}
	}

	fmt.Printf("\n完成：成功 %d，跳过/失败 %d\n", success, fail)
}
