# 1. [mssql-mcp-server](https://smithery.ai/server/@knight0zh/mssql-mcp-server)
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