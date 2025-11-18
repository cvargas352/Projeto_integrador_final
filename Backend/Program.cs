using Microsoft.Data.SqlClient;
using System.Data;
using System.Text.Json;
using System.Linq;
using System.Collections.Generic;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();
builder.Services.AddDirectoryBrowser();

// 🔹 Lê a connection string direto do builder (config carregada do appsettings.json)
var connectionString = builder.Configuration.GetConnectionString("DefaultConnection");

if (string.IsNullOrWhiteSpace(connectionString))
{
    throw new InvalidOperationException(
        "Connection string 'DefaultConnection' não encontrada. " +
        "Verifique se ela está definida em appsettings.json.");
}

var app = builder.Build();

// sempre registra o Swagger, inclusive em produção
app.UseSwagger();
app.UseSwaggerUI(c =>
{
    c.SwaggerEndpoint("/swagger/v1/swagger.json", "DigitalMenu API v1");
    c.RoutePrefix = "swagger"; // opcional, só deixa explícito
});

app.UseDefaultFiles();
app.UseStaticFiles();
app.UseHttpsRedirection();


// ======================
// USERS
// ======================

// Registrar usuário (cliente ou restaurante)
app.MapPost("/api/users/register", async (RegisterUserRequest req) =>
{
    await using var conn = new SqlConnection(connectionString);
    await conn.OpenAsync();

    // Verifica se email já existe
    var checkCmd = new SqlCommand("SELECT COUNT(1) FROM Users WHERE Email = @Email", conn);
    checkCmd.Parameters.AddWithValue("@Email", req.Email);
    var exists = (int)await checkCmd.ExecuteScalarAsync() > 0;
    if (exists)
    {
        return Results.Conflict("Já existe um usuário com esse e-mail.");
    }

    var cmd = new SqlCommand(
        @"INSERT INTO Users (Name, Email, Phone, Password, Role) 
          OUTPUT INSERTED.Id, INSERTED.CreatedAt
          VALUES (@Name, @Email, @Phone, @Password, @Role)", conn);

    cmd.Parameters.AddWithValue("@Name", req.Name);
    cmd.Parameters.AddWithValue("@Email", req.Email);
    cmd.Parameters.AddWithValue("@Phone", (object?)req.Phone ?? DBNull.Value);
    cmd.Parameters.AddWithValue("@Password", req.Password); // simples, sem hash
    cmd.Parameters.AddWithValue("@Role", req.Role);

    await using var reader = await cmd.ExecuteReaderAsync();
    if (await reader.ReadAsync())
    {
        var id = reader.GetInt32(0);
        var createdAt = reader.GetDateTime(1);
        var userResp = new UserResponse(id, req.Name, req.Email, req.Phone, req.Role, createdAt);
        return Results.Created($"/api/users/{id}", userResp);
    }

    return Results.Problem("Erro ao registrar usuário.");
});

// Login (cliente ou restaurante)
app.MapPost("/api/users/login", async (LoginRequest req) =>
{
    await using var conn = new SqlConnection(connectionString);
    await conn.OpenAsync();

    var cmd = new SqlCommand(
        @"SELECT Id, Name, Email, Phone, Password, Role, CreatedAt 
          FROM Users WHERE Email = @Email", conn);
    cmd.Parameters.AddWithValue("@Email", req.Email);

    await using var reader = await cmd.ExecuteReaderAsync();
    if (!await reader.ReadAsync())
    {
        return Results.Unauthorized();
    }

    var password = reader.GetString(4);
    if (!string.Equals(password, req.Password))
    {
        return Results.Unauthorized();
    }

    var user = new UserResponse(
        reader.GetInt32(0),
        reader.GetString(1),
        reader.GetString(2),
        reader.IsDBNull(3) ? "" : reader.GetString(3),
        reader.GetString(5),
        reader.GetDateTime(6)
    );

    return Results.Ok(user);
});

// Obter usuário por Id (para "Meu Perfil")
app.MapGet("/api/users/{id:int}", async (int id) =>
{
    await using var conn = new SqlConnection(connectionString);
    await conn.OpenAsync();

    var cmd = new SqlCommand(
        @"SELECT Id, Name, Email, Phone, Role, CreatedAt 
          FROM Users WHERE Id = @Id", conn);
    cmd.Parameters.AddWithValue("@Id", id);

    await using var reader = await cmd.ExecuteReaderAsync();
    if (!await reader.ReadAsync())
    {
        return Results.NotFound();
    }

    var user = new UserResponse(
        reader.GetInt32(0),
        reader.GetString(1),
        reader.GetString(2),
        reader.IsDBNull(3) ? "" : reader.GetString(3),
        reader.GetString(4),
        reader.GetDateTime(5)
    );

    return Results.Ok(user);
});

// Atualizar dados básicos do usuário (Meu Perfil)
app.MapPut("/api/users/{id:int}", async (int id, RegisterUserRequest req) =>
{
    await using var conn = new SqlConnection(connectionString);
    await conn.OpenAsync();

    var cmd = new SqlCommand(
        @"UPDATE Users 
          SET Name = @Name, Phone = @Phone 
          WHERE Id = @Id", conn);

    cmd.Parameters.AddWithValue("@Id", id);
    cmd.Parameters.AddWithValue("@Name", req.Name);
    cmd.Parameters.AddWithValue("@Phone", (object?)req.Phone ?? DBNull.Value);

    var rows = await cmd.ExecuteNonQueryAsync();
    if (rows == 0) return Results.NotFound();

    return Results.NoContent();
});

// ======================
// PRODUCTS
// ======================

// Listar produtos (cliente e restaurante)
app.MapGet("/api/products", async () =>
{
    var products = new List<object>();

    await using var conn = new SqlConnection(connectionString);
    await conn.OpenAsync();

    var cmd = new SqlCommand(
        @"SELECT Id, Name, Description, Category, Price, IsActive, CreatedAt 
          FROM Products", conn);

    await using var reader = await cmd.ExecuteReaderAsync();
    while (await reader.ReadAsync())
    {
        products.Add(new
        {
            Id = reader.GetInt32(0),
            Name = reader.GetString(1),
            Description = reader.IsDBNull(2) ? "" : reader.GetString(2),
            Category = reader.IsDBNull(3) ? "" : reader.GetString(3),
            Price = reader.GetDecimal(4),
            IsActive = reader.GetBoolean(5),
            CreatedAt = reader.GetDateTime(6)
        });
    }

    return Results.Ok(products);
});

// Criar produto (restaurante)
app.MapPost("/api/products", async (CreateProductRequest req) =>
{
    await using var conn = new SqlConnection(connectionString);
    await conn.OpenAsync();

    var cmd = new SqlCommand(
        @"INSERT INTO Products (Name, Description, Category, Price, IsActive)
          OUTPUT INSERTED.Id, INSERTED.CreatedAt
          VALUES (@Name, @Description, @Category, @Price, 1)", conn);

    cmd.Parameters.AddWithValue("@Name", req.Name);
    cmd.Parameters.AddWithValue("@Description", (object?)req.Description ?? DBNull.Value);
    cmd.Parameters.AddWithValue("@Category", (object?)req.Category ?? DBNull.Value);
    cmd.Parameters.AddWithValue("@Price", req.Price);

    await using var reader = await cmd.ExecuteReaderAsync();
    if (await reader.ReadAsync())
    {
        var id = reader.GetInt32(0);
        var createdAt = reader.GetDateTime(1);

        var product = new
        {
            Id = id,
            req.Name,
            req.Description,
            req.Category,
            req.Price,
            IsActive = true,
            CreatedAt = createdAt
        };

        return Results.Created($"/api/products/{id}", product);
    }

    return Results.Problem("Erro ao criar produto.");
});

// Atualizar produto
app.MapPut("/api/products/{id:int}", async (int id, UpdateProductRequest req) =>
{
    await using var conn = new SqlConnection(connectionString);
    await conn.OpenAsync();

    var cmd = new SqlCommand(
        @"UPDATE Products
          SET Name = @Name,
              Description = @Description,
              Category = @Category,
              Price = @Price,
              IsActive = @IsActive
          WHERE Id = @Id", conn);

    cmd.Parameters.AddWithValue("@Id", id);
    cmd.Parameters.AddWithValue("@Name", req.Name);
    cmd.Parameters.AddWithValue("@Description", (object?)req.Description ?? DBNull.Value);
    cmd.Parameters.AddWithValue("@Category", (object?)req.Category ?? DBNull.Value);
    cmd.Parameters.AddWithValue("@Price", req.Price);
    cmd.Parameters.AddWithValue("@IsActive", req.IsActive);

    var rows = await cmd.ExecuteNonQueryAsync();
    if (rows == 0) return Results.NotFound();

    return Results.NoContent();
});

// ======================
// ORDERS
// ======================

// Criar pedido (cliente)
app.MapPost("/api/orders", async (CreateOrderRequest req) =>
{
    if (req.Items == null || req.Items.Count == 0)
    {
        return Results.BadRequest("O pedido precisa ter ao menos 1 item.");
    }

    var total = req.Items.Sum(i => i.UnitPrice * i.Quantity);

    await using var conn = new SqlConnection(connectionString);
    await conn.OpenAsync();

    await using var tx = await conn.BeginTransactionAsync();

    try
    {
        // Inserir pedido
        var orderCmd = new SqlCommand(
            @"INSERT INTO Orders (UserId, Status, Total, DeliveryAddress)
              OUTPUT INSERTED.Id, INSERTED.CreatedAt
              VALUES (@UserId, @Status, @Total, @DeliveryAddress)", conn, (SqlTransaction)tx);

        orderCmd.Parameters.AddWithValue("@UserId", req.UserId);
        orderCmd.Parameters.AddWithValue("@Status", "Criado");
        orderCmd.Parameters.AddWithValue("@Total", total);
        orderCmd.Parameters.AddWithValue("@DeliveryAddress", (object?)req.DeliveryAddress ?? DBNull.Value);

        int orderId;
        DateTime createdAt;

        await using (var reader = await orderCmd.ExecuteReaderAsync())
        {
            await reader.ReadAsync();
            orderId = reader.GetInt32(0);
            createdAt = reader.GetDateTime(1);
        }

        // Inserir itens
        foreach (var item in req.Items)
        {
            var itemCmd = new SqlCommand(
                @"INSERT INTO OrderItems (OrderId, ProductId, ProductName, Quantity, UnitPrice)
                  VALUES (@OrderId, @ProductId, @ProductName, @Quantity, @UnitPrice)",
                conn, (SqlTransaction)tx);

            itemCmd.Parameters.AddWithValue("@OrderId", orderId);
            itemCmd.Parameters.AddWithValue("@ProductId", item.ProductId);
            itemCmd.Parameters.AddWithValue("@ProductName", item.ProductName);
            itemCmd.Parameters.AddWithValue("@Quantity", item.Quantity);
            itemCmd.Parameters.AddWithValue("@UnitPrice", item.UnitPrice);

            await itemCmd.ExecuteNonQueryAsync();
        }

        await tx.CommitAsync();

        var orderResp = new OrderResponse(
            orderId,
            req.UserId,
            "Criado",
            total,
            req.DeliveryAddress,
            createdAt,
            req.Items.Select(i => new OrderItemResponse(i.ProductId, i.ProductName, i.Quantity, i.UnitPrice)).ToList()
        );

        return Results.Created($"/api/orders/{orderId}", orderResp);
    }
    catch (Exception ex)
    {
        await tx.RollbackAsync();
        return Results.Problem("Erro ao criar pedido: " + ex.Message);
    }
});

// Listar pedidos (para o restaurante, todos)
app.MapGet("/api/orders", async () =>
{
    var orders = new Dictionary<int, OrderResponse>();

    await using var conn = new SqlConnection(connectionString);
    await conn.OpenAsync();

    // Busca pedidos
    var orderCmd = new SqlCommand(
        @"SELECT Id, UserId, Status, Total, DeliveryAddress, CreatedAt
          FROM Orders", conn);

    await using (var reader = await orderCmd.ExecuteReaderAsync())
    {
        while (await reader.ReadAsync())
        {
            var id = reader.GetInt32(0);
            var order = new OrderResponse(
                id,
                reader.GetInt32(1),
                reader.GetString(2),
                reader.GetDecimal(3),
                reader.IsDBNull(4) ? "" : reader.GetString(4),
                reader.GetDateTime(5),
                new List<OrderItemResponse>()
            );
            orders[id] = order;
        }
    }

    // Busca itens
    var itemCmd = new SqlCommand(
        @"SELECT OrderId, ProductId, ProductName, Quantity, UnitPrice
          FROM OrderItems", conn);

    await using (var reader = await itemCmd.ExecuteReaderAsync())
    {
        while (await reader.ReadAsync())
        {
            var orderId = reader.GetInt32(0);
            if (!orders.TryGetValue(orderId, out var order)) continue;

            var item = new OrderItemResponse(
                reader.GetInt32(1),
                reader.GetString(2),
                reader.GetInt32(3),
                reader.GetDecimal(4)
            );

            order.Items.Add(item);
        }
    }

    return Results.Ok(orders.Values);
});

// Atualizar status do pedido (restaurante)
app.MapPut("/api/orders/{id:int}/status", async (int id, UpdateOrderStatusRequest req) =>
{
    await using var conn = new SqlConnection(connectionString);
    await conn.OpenAsync();

    var cmd = new SqlCommand(
        @"UPDATE Orders SET Status = @Status WHERE Id = @Id", conn);
    cmd.Parameters.AddWithValue("@Id", id);
    cmd.Parameters.AddWithValue("@Status", req.Status);

    var rows = await cmd.ExecuteNonQueryAsync();
    if (rows == 0) return Results.NotFound();

    return Results.NoContent();
});

app.Run();
