using Microsoft.AspNetCore.Mvc;
using Xunit;

namespace PropelIQ.API.UnitTests;

// Simple test controller within the test file
public class HealthController
{
    public IActionResult Get()
    {
        return new OkObjectResult("healthy");
    }
}

public class HealthControllerTests
{
    [Fact]
    public void Get_ReturnsHealthyMessage()
    {
        // Arrange
        var controller = new HealthController();

        // Act
        var result = controller.Get();

        // Assert
        var okResult = Assert.IsType<OkObjectResult>(result);
        Assert.Equal("healthy", okResult.Value);
    }
}
