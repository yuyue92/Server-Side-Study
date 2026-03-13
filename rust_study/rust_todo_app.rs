use std::fs::{File, OpenOptions};
use std::io::{self, BufRead, BufReader, Write};
use std::path::Path;

// 任务结构体
#[derive(Debug, Clone)]
struct Task {
    id: usize,
    description: String,
    completed: bool,
}

// 任务管理器
struct TodoList {
    tasks: Vec<Task>,
    file_path: String,
}

impl TodoList {
    // 创建新的TodoList实例
    fn new(file_path: &str) -> io::Result<Self> {
        let mut todo_list = TodoList {
            tasks: Vec::new(),
            file_path: file_path.to_string(),
        };
        todo_list.load_from_file()?;
        Ok(todo_list)
    }

    // 从文件加载任务
    fn load_from_file(&mut self) -> io::Result<()> {
        if !Path::new(&self.file_path).exists() {
            return Ok(());
        }

        let file = File::open(&self.file_path)?;
        let reader = BufReader::new(file);

        for line in reader.lines() {
            let line = line?;
            let parts: Vec<&str> = line.split('|').collect();
            if parts.len() == 3 {
                let task = Task {
                    id: parts[0].parse().unwrap_or(0),
                    description: parts[1].to_string(),
                    completed: parts[2] == "true",
                };
                self.tasks.push(task);
            }
        }
        Ok(())
    }

    // 保存任务到文件
    fn save_to_file(&self) -> io::Result<()> {
        let mut file = OpenOptions::new()
            .write(true)
            .create(true)
            .truncate(true)
            .open(&self.file_path)?;

        for task in &self.tasks {
            writeln!(file, "{}|{}|{}", task.id, task.description, task.completed)?;
        }
        Ok(())
    }

    // 添加新任务
    fn add_task(&mut self, description: String) -> io::Result<()> {
        let id = self.tasks.len() + 1;
        let task = Task {
            id,
            description,
            completed: false,
        };
        self.tasks.push(task);
        self.save_to_file()?;
        println!("✓ 任务已添加 (ID: {})", id);
        Ok(())
    }

    // 标记任务完成
    fn complete_task(&mut self, id: usize) -> io::Result<()> {
        if let Some(task) = self.tasks.iter_mut().find(|t| t.id == id) {
            task.completed = true;
            self.save_to_file()?;
            println!("✓ 任务 {} 已完成", id);
        } else {
            println!("✗ 未找到ID为 {} 的任务", id);
        }
        Ok(())
    }

    // 删除任务
    fn delete_task(&mut self, id: usize) -> io::Result<()> {
        let original_len = self.tasks.len();
        self.tasks.retain(|t| t.id != id);
        
        if self.tasks.len() < original_len {
            self.save_to_file()?;
            println!("✓ 任务 {} 已删除", id);
        } else {
            println!("✗ 未找到ID为 {} 的任务", id);
        }
        Ok(())
    }

    // 列出所有任务
    fn list_tasks(&self) {
        if self.tasks.is_empty() {
            println!("没有任务！");
            return;
        }

        println!("\n==== 任务列表 ====");
        for task in &self.tasks {
            let status = if task.completed { "✓" } else { "○" };
            println!("[{}] {} - {}", status, task.id, task.description);
        }
        println!("==================\n");
    }
}

fn main() -> io::Result<()> {
    let mut todo_list = TodoList::new("tasks.txt")?;

    println!("欢迎使用 Rust TODO 应用!");
    println!("命令: add <任务> | complete <ID> | delete <ID> | list | quit");

    loop {
        print!("\n> ");
        io::stdout().flush()?;

        let mut input = String::new();
        io::stdin().read_line(&mut input)?;
        let input = input.trim();

        let parts: Vec<&str> = input.splitn(2, ' ').collect();
        let command = parts[0];

        match command {
            "add" => {
                if parts.len() > 1 {
                    todo_list.add_task(parts[1].to_string())?;
                } else {
                    println!("用法: add <任务描述>");
                }
            }
            "complete" => {
                if parts.len() > 1 {
                    if let Ok(id) = parts[1].parse::<usize>() {
                        todo_list.complete_task(id)?;
                    } else {
                        println!("无效的任务ID");
                    }
                } else {
                    println!("用法: complete <ID>");
                }
            }
            "delete" => {
                if parts.len() > 1 {
                    if let Ok(id) = parts[1].parse::<usize>() {
                        todo_list.delete_task(id)?;
                    } else {
                        println!("无效的任务ID");
                    }
                } else {
                    println!("用法: delete <ID>");
                }
            }
            "list" => {
                todo_list.list_tasks();
            }
            "quit" | "exit" => {
                println!("再见!");
                break;
            }
            "" => continue,
            _ => {
                println!("未知命令: {}", command);
            }
        }
    }

    Ok(())
}
