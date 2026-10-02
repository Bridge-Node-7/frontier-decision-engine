    page.locator(f"#decision-step-heading-{index}").wait_for(state="visible")


def activate_ready_example(page: Page) -> None:
    expected_message = "Open the ready example? This replaces the decision currently open in this browser."
    expected_question = "Which source-qualification pathway creates the strongest readiness across changing conditions?"
    page.evaluate(
        """() => {
          window.__fdeReadyExampleConfirmation = {
            original: window.confirm,
            invoked: false,
            message: null,
            result: null,
          };
          window.confirm = (message) => {
            const state = window.__fdeReadyExampleConfirmation;
            state.invoked = true;
            state.message = String(message);
            state.result = true;
            return true;
          };
        }"""
    )
    button = page.locator("#use-ready-example")
    try:
        button.wait_for(state="visible")
        assert button.is_visible(), "ready-example button is not visible"
        assert button.is_enabled(), "ready-example button is not enabled"
        button.click()
        page.locator("#decision-save-status").filter(
            has_text=re.compile(r"^Synthetic example$")
        ).wait_for(state="visible")
        page.locator("#decision-step-heading-0").wait_for(state="visible")
        confirmation = page.evaluate(
            """() => ({
              invoked: window.__fdeReadyExampleConfirmation?.invoked ?? false,
              message: window.__fdeReadyExampleConfirmation?.message ?? null,
              result: window.__fdeReadyExampleConfirmation?.result ?? null,
            })"""
        )
        assert confirmation == {"invoked": True, "message": expected_message, "result": True}
        assert page.locator("#decision-save-status").inner_text() == "Synthetic example"
        assert page.locator("#decision-question").input_value() == expected_question
        assert page.locator('[data-decision-stage]').count() == 6
        page.locator("#decision-step-heading-0").wait_for(state="visible")
    except Exception as exc:
        diagnostics = page.evaluate(
            """() => {
              const button = document.querySelector('#use-ready-example');
              const openStage = document.querySelector('[data-decision-stage][open]');
              const confirmation = window.__fdeReadyExampleConfirmation;
              return {
                url: location.href,
                hash: location.hash,
                route: document.querySelector('main')?.dataset.route ?? null,
                saveStatus: document.querySelector('#decision-save-status')?.textContent?.trim() ?? null,
                decisionQuestion: document.querySelector('#decision-question')?.value ?? null,
                openStageIndex: openStage?.dataset.decisionStage ?? null,
                confirmationInvoked: confirmation?.invoked ?? false,
                confirmationMessage: confirmation?.message ?? null,
                confirmationResult: confirmation?.result ?? null,
                buttonVisible: !!button && button.getClientRects().length > 0,
                buttonEnabled: !!button && !button.disabled,
              };
            }"""
        )
        raise AssertionError(f"ready-example transition failed: {diagnostics}") from exc
    finally:
        page.evaluate(
            """() => {
              const state = window.__fdeReadyExampleConfirmation;
              if (state?.original) window.confirm = state.original;
              delete window.__fdeReadyExampleConfirmation;
            }"""
        )


def decision_flow(page: Page, base: str) -> str:
    route(page, base, "/decision", '[data-surface="fde-hero"] h1', "Frontier Decision Engine")
    assert page.locator('[data-surface="integrated-method"]').is_visible()
    assert page.locator('[data-decision-stage]').count() == 6
    assert page.locator('[data-decision-stage][open]').count() == 1
    assert page.locator("#decision-question").is_visible()
    overview = page.locator("#mobile-overview-action")
    if page.evaluate("window.innerWidth <= 760"):
        assert overview.is_visible()
        assert overview.get_attribute("href") == "#how-it-works"
        assert overview.bounding_box()["y"] < page.locator('[data-decision-stage="0"]').bounding_box()["y"]
    else:
        assert not overview.is_visible()
    assert page.locator("#decision-question").input_value() == ""
    assert page.locator("#use-ready-example").is_visible()