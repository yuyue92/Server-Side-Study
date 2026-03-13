use std::collections::HashMap;
use std::fmt;

// JSON值的枚举表示
#[derive(Debug, Clone, PartialEq)]
enum JsonValue {
    Null,
    Boolean(bool),
    Number(f64),
    String(String),
    Array(Vec<JsonValue>),
    Object(HashMap<String, JsonValue>),
}

// 自定义Display trait用于美化输出
impl fmt::Display for JsonValue {
    fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
        match self {
            JsonValue::Null => write!(f, "null"),
            JsonValue::Boolean(b) => write!(f, "{}", b),
            JsonValue::Number(n) => write!(f, "{}", n),
            JsonValue::String(s) => write!(f, "\"{}\"", s),
            JsonValue::Array(arr) => {
                write!(f, "[")?;
                for (i, v) in arr.iter().enumerate() {
                    if i > 0 {
                        write!(f, ", ")?;
                    }
                    write!(f, "{}", v)?;
                }
                write!(f, "]")
            }
            JsonValue::Object(obj) => {
                write!(f, "{{")?;
                for (i, (k, v)) in obj.iter().enumerate() {
                    if i > 0 {
                        write!(f, ", ")?;
                    }
                    write!(f, "\"{}\": {}", k, v)?;
                }
                write!(f, "}}")
            }
        }
    }
}

// JSON解析器
struct JsonParser {
    input: Vec<char>,
    pos: usize,
}

impl JsonParser {
    fn new(input: &str) -> Self {
        JsonParser {
            input: input.chars().collect(),
            pos: 0,
        }
    }

    fn parse(&mut self) -> Result<JsonValue, String> {
        self.skip_whitespace();
        self.parse_value()
    }

    fn current(&self) -> Option<char> {
        if self.pos < self.input.len() {
            Some(self.input[self.pos])
        } else {
            None
        }
    }

    fn advance(&mut self) {
        self.pos += 1;
    }

    fn skip_whitespace(&mut self) {
        while let Some(ch) = self.current() {
            if ch.is_whitespace() {
                self.advance();
            } else {
                break;
            }
        }
    }

    fn parse_value(&mut self) -> Result<JsonValue, String> {
        self.skip_whitespace();
        
        match self.current() {
            Some('n') => self.parse_null(),
            Some('t') | Some('f') => self.parse_boolean(),
            Some('"') => self.parse_string(),
            Some('[') => self.parse_array(),
            Some('{') => self.parse_object(),
            Some(ch) if ch.is_numeric() || ch == '-' => self.parse_number(),
            _ => Err("无效的JSON值".to_string()),
        }
    }

    fn parse_null(&mut self) -> Result<JsonValue, String> {
        let expected = "null";
        for expected_char in expected.chars() {
            if self.current() == Some(expected_char) {
                self.advance();
            } else {
                return Err("解析null失败".to_string());
            }
        }
        Ok(JsonValue::Null)
    }

    fn parse_boolean(&mut self) -> Result<JsonValue, String> {
        let start = self.pos;
        while let Some(ch) = self.current() {
            if ch.is_alphabetic() {
                self.advance();
            } else {
                break;
            }
        }
        
        let value: String = self.input[start..self.pos].iter().collect();
        match value.as_str() {
            "true" => Ok(JsonValue::Boolean(true)),
            "false" => Ok(JsonValue::Boolean(false)),
            _ => Err("无效的布尔值".to_string()),
        }
    }

    fn parse_number(&mut self) -> Result<JsonValue, String> {
        let start = self.pos;
        
        if self.current() == Some('-') {
            self.advance();
        }
        
        while let Some(ch) = self.current() {
            if ch.is_numeric() || ch == '.' {
                self.advance();
            } else {
                break;
            }
        }
        
        let num_str: String = self.input[start..self.pos].iter().collect();
        num_str.parse::<f64>()
            .map(JsonValue::Number)
            .map_err(|_| "无效的数字".to_string())
    }

    fn parse_string(&mut self) -> Result<JsonValue, String> {
        self.advance(); // 跳过开头的引号
        let start = self.pos;
        
        while let Some(ch) = self.current() {
            if ch == '"' {
                let s: String = self.input[start..self.pos].iter().collect();
                self.advance(); // 跳过结尾的引号
                return Ok(JsonValue::String(s));
            }
            self.advance();
        }
        
        Err("未闭合的字符串".to_string())
    }

    fn parse_array(&mut self) -> Result<JsonValue, String> {
        self.advance(); // 跳过 '['
        let mut array = Vec::new();
        
        self.skip_whitespace();
        if self.current() == Some(']') {
            self.advance();
            return Ok(JsonValue::Array(array));
        }
        
        loop {
            array.push(self.parse_value()?);
            self.skip_whitespace();
            
            match self.current() {
                Some(',') => {
                    self.advance();
                    self.skip_whitespace();
                }
                Some(']') => {
                    self.advance();
                    break;
                }
                _ => return Err("数组格式错误".to_string()),
            }
        }
        
        Ok(JsonValue::Array(array))
    }

    fn parse_object(&mut self) -> Result<JsonValue, String> {
        self.advance(); // 跳过 '{'
        let mut object = HashMap::new();
        
        self.skip_whitespace();
        if self.current() == Some('}') {
            self.advance();
            return Ok(JsonValue::Object(object));
        }
        
        loop {
            self.skip_whitespace();
            
            // 解析键
            let key = match self.parse_string()? {
                JsonValue::String(s) => s,
                _ => return Err("对象的键必须是字符串".to_string()),
            };
            
            self.skip_whitespace();
            if self.current() != Some(':') {
                return Err("期望':'".to_string());
            }
            self.advance();
            
            // 解析值
            let value = self.parse_value()?;
            object.insert(key, value);
            
            self.skip_whitespace();
            match self.current() {
                Some(',') => {
                    self.advance();
                }
                Some('}') => {
                    self.advance();
                    break;
                }
                _ => return Err("对象格式错误".to_string()),
            }
        }
        
        Ok(JsonValue::Object(object))
    }
}

fn main() {
    println!("=== Rust JSON 解析器 ===\n");

    // 测试案例
    let test_cases = vec![
        r#"null"#,
        r#"true"#,
        r#"42"#,
        r#""hello world""#,
        r#"[1, 2, 3, 4, 5]"#,
        r#"{"name": "张三", "age": 30, "active": true}"#,
        r#"{
            "users": [
                {"id": 1, "name": "Alice"},
                {"id": 2, "name": "Bob"}
            ],
            "total": 2
        }"#,
    ];

    for (i, test) in test_cases.iter().enumerate() {
        println!("测试 {}:", i + 1);
        println!("输入: {}", test);
        
        let mut parser = JsonParser::new(test);
        match parser.parse() {
            Ok(value) => {
                println!("解析成功!");
                println!("结果: {}", value);
                println!("Debug: {:?}\n", value);
            }
            Err(e) => {
                println!("解析失败: {}\n", e);
            }
        }
    }

    // 演示值操作
    println!("\n=== 值操作演示 ===");
    let mut obj = HashMap::new();
    obj.insert("status".to_string(), JsonValue::String("success".to_string()));
    obj.insert("code".to_string(), JsonValue::Number(200.0));
    
    let json = JsonValue::Object(obj);
    println!("创建的JSON对象: {}", json);
}
