using Microsoft.AspNetCore.Mvc;

namespace PropelIQ.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class HealthController : ControllerBase
{
    [HttpGet]
    public IActionResult Get()
    {
        return Ok("healthy");
    }
}
