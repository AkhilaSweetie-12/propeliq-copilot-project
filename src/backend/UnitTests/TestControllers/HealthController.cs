using Microsoft.AspNetCore.Mvc;

namespace PropelIQ.API.UnitTests.TestControllers;

public class HealthController
{
    public IActionResult Get()
    {
        return new OkObjectResult("healthy");
    }
}
