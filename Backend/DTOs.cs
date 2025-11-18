// NÃO coloque namespace nem classe aqui

// DTOs de usuário
public record RegisterUserRequest(string Name, string Email, string Phone, string Password, string Role);
public record LoginRequest(string Email, string Password);
public record UserResponse(int Id, string Name, string Email, string Phone, string Role, DateTime CreatedAt);

// DTOs de produto
public record CreateProductRequest(string Name, string Description, string Category, decimal Price);
public record UpdateProductRequest(string Name, string Description, string Category, decimal Price, bool IsActive);

// DTOs de pedido
public record OrderItemRequest(int ProductId, string ProductName, int Quantity, decimal UnitPrice);
public record CreateOrderRequest(int UserId, string DeliveryAddress, List<OrderItemRequest> Items);

public record OrderItemResponse(int ProductId, string ProductName, int Quantity, decimal UnitPrice);
public record OrderResponse(int Id, int UserId, string Status, decimal Total, string DeliveryAddress, DateTime CreatedAt, List<OrderItemResponse> Items);

public record UpdateOrderStatusRequest(string Status);