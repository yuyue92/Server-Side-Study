use std::collections::{HashSet, VecDeque};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::Duration;

// 简化的HTTP客户端（实际项目中应使用reqwest或类似库）
// 这里我们模拟HTTP请求
struct HttpClient;

impl HttpClient {
    fn get(url: &str) -> Result<String, String> {
        // 模拟网络延迟
        thread::sleep(Duration::from_millis(100));
        
        // 模拟HTML响应
        Ok(format!(
            r#"<html>
                <body>
                    <h1>Page: {}</h1>
                    <a href="https://example.com/page1">Link 1</a>
                    <a href="https://example.com/page2">Link 2</a>
                    <a href="https://external.com">External</a>
                </body>
            </html>"#,
            url
        ))
    }
}

// 从HTML中提取链接
fn extract_links(html: &str, base_url: &str) -> Vec<String> {
    let mut links = Vec::new();
    
    // 简单的链接提取（实际应使用HTML解析器如scraper）
    for line in html.lines() {
        if line.contains("href=") {
            if let Some(start) = line.find("href=\"") {
                let start = start + 6;
                if let Some(end) = line[start..].find('"') {
                    let link = &line[start..start + end];
                    if link.starts_with(base_url) {
                        links.push(link.to_string());
                    }
                }
            }
        }
    }
    
    links
}

// 爬虫结构
struct Crawler {
    base_url: String,
    max_pages: usize,
    max_threads: usize,
}

impl Crawler {
    fn new(base_url: String, max_pages: usize, max_threads: usize) -> Self {
        Crawler {
            base_url,
            max_pages,
            max_threads,
        }
    }

    fn crawl(&self) -> CrawlResult {
        // 共享状态
        let visited = Arc::new(Mutex::new(HashSet::new()));
        let queue = Arc::new(Mutex::new(VecDeque::new()));
        let results = Arc::new(Mutex::new(Vec::new()));

        // 初始化队列
        {
            let mut q = queue.lock().unwrap();
            q.push_back(self.base_url.clone());
        }

        let mut handles = vec![];

        // 创建工作线程
        for thread_id in 0..self.max_threads {
            let visited = Arc::clone(&visited);
            let queue = Arc::clone(&queue);
            let results = Arc::clone(&results);
            let base_url = self.base_url.clone();
            let max_pages = self.max_pages;

            let handle = thread::spawn(move || {
                loop {
                    // 从队列获取URL
                    let url = {
                        let mut q = queue.lock().unwrap();
                        q.pop_front()
                    };

                    match url {
                        Some(url) => {
                            // 检查是否已访问
                            let should_visit = {
                                let mut v = visited.lock().unwrap();
                                if v.len() >= max_pages {
                                    return;
                                }
                                v.insert(url.clone())
                            };

                            if !should_visit {
                                continue;
                            }

                            println!("[线程 {}] 正在爬取: {}", thread_id, url);

                            // 发起HTTP请求
                            match HttpClient::get(&url) {
                                Ok(html) => {
                                    let links = extract_links(&html, &base_url);
                                    
                                    // 添加新链接到队列
                                    {
                                        let mut q = queue.lock().unwrap();
                                        for link in &links {
                                            q.push_back(link.clone());
                                        }
                                    }

                                    // 保存结果
                                    {
                                        let mut r = results.lock().unwrap();
                                        r.push(PageResult {
                                            url: url.clone(),
                                            links_found: links.len(),
                                            success: true,
                                        });
                                    }
                                }
                                Err(e) => {
                                    println!("[线程 {}] 错误: {} - {}", thread_id, url, e);
                                    let mut r = results.lock().unwrap();
                                    r.push(PageResult {
                                        url: url.clone(),
                                        links_found: 0,
                                        success: false,
                                    });
                                }
                            }
                        }
                        None => {
                            // 队列为空，检查是否所有工作完成
                            thread::sleep(Duration::from_millis(100));
                            let q = queue.lock().unwrap();
                            let v = visited.lock().unwrap();
                            if q.is_empty() && v.len() >= max_pages {
                                return;
                            }
                        }
                    }
                }
            });

            handles.push(handle);
        }

        // 等待所有线程完成
        for handle in handles {
            handle.join().unwrap();
        }

        // 收集结果
        let results = results.lock().unwrap();
        let visited = visited.lock().unwrap();

        CrawlResult {
            pages_crawled: visited.len(),
            page_results: results.clone(),
        }
    }
}

#[derive(Clone, Debug)]
struct PageResult {
    url: String,
    links_found: usize,
    success: bool,
}

struct CrawlResult {
    pages_crawled: usize,
    page_results: Vec<PageResult>,
}

fn main() {
    println!("=== Rust 多线程网络爬虫 ===\n");

    let crawler = Crawler::new(
        "https://example.com".to_string(),
        10,  // 最多爬取10个页面
        4,   // 使用4个线程
    );

    println!("开始爬取...\n");
    let result = crawler.crawl();

    println!("\n=== 爬取完成 ===");
    println!("总共爬取页面数: {}", result.pages_crawled);
    println!("\n页面详情:");
    
    for (i, page) in result.page_results.iter().enumerate() {
        println!(
            "{}. {} - {} 个链接 [{}]",
            i + 1,
            page.url,
            page.links_found,
            if page.success { "成功" } else { "失败" }
        );
    }
}
