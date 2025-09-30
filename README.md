# 1.MySql [mssql-mcp-server](https://smithery.ai/server/@knight0zh/mssql-mcp-server)
> https://github.com/knight0zh/mssql-mcp-server
- 配置

```bash
cnpm install mssql-mcp-server
```

```json
{
  "mcpServers": {
    "mssql": {
      "command": "mssql-mcp-server",
      "env": {
        "MSSQL_CONNECTION_STRING": "Server=localhost;Database=master;User Id=sa;Password=yourpassword;",
        // Or individual connection parameters:
        "MSSQL_HOST": "localhost",
        "MSSQL_PORT": "3306", // 1433
        "MSSQL_DATABASE": "beijing_trip",
        "MSSQL_USER": "root",
        "MSSQL_PASSWORD": "a123456",
        "MSSQL_ENCRYPT": "false",
        "MSSQL_TRUST_SERVER_CERTIFICATE": "true"
      }
    }
  }
}
```


# 2.高德地图 [amap-maps-mcp-server](https://mcp.so/zh/server/amap-maps/amap?tab=tools)
https://mcp.so/zh/server/amap-maps/amap?tab=content

- web服务Key：e3d4cbac03e5c2a465ab04b682ca005f
> [高德地图MCP Server](https://lbs.amap.com/api/mcp-server/create-project-and-key)

# 3. FileSystem []()



现在交给你一个任务，编写一个北京一日游的出行攻略
 1、从高德地图的MCP服务中获取北京站到天安门、天安门到颐和园、颐和园到南锣鼓巷的地铁线路，并保存在数据库beijing_trip的表subway_trips中
 2、从高德地图的MCP中获取颐和园、南锣鼓巷附件的美食信息，每处获取三家美食店铺信息，并将相应的信息存入表location_foods中
 3、在工作目录 F:\AI\mcp\mcp-study(就是当前工作目录)下创建一个新的文件夹，命名为"北京旅行”在其中创建两个txt，分别从数据库中将两个表的内容提取出存放进去。
 4、最后根据txt中的内容，生成一个精美的html前端展示页面，并存放在该目录下